"use client";

import { signOut } from "next-auth/react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { AvatarCropModal } from "@/components/profile/AvatarCropModal";
import { ProfileSharedEntriesFeed } from "@/components/profile-shared-entries-feed";
import { formatDate } from "@/lib/time";
import type { ProfileSharedEntryItem } from "@/lib/profile-shared-entries";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

type AccountPanelProps = {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  timeZone: string;
  initialUsername: string;
  initialImage: string | null;
  initialSharedEntries: ProfileSharedEntryItem[];
  initialSharedEntriesNextCursor: string | null;
};

type DeleteAccountResponse = {
  ok?: boolean;
  error?: string;
};

type UpdateProfileResponse = {
  ok?: boolean;
  error?: string;
  user?: {
    username?: string | null;
    image?: string | null;
  };
};

type UsernameAvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

const DELETE_CONFIRMATION_TEXT = "DELETE MY DATA";

function formatMemberSince(createdAt: string, timeZone: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
    timeZone,
  })
    .format(date)
    .toLowerCase();
}

export function AccountPanel({
  createdAt,
  email,
  emailVerified,
  timeZone,
  initialUsername,
  initialImage,
  initialSharedEntries,
  initialSharedEntriesNextCursor,
}: AccountPanelProps) {
  const [username, setUsername] = useState(initialUsername);
  const [image, setImage] = useState(initialImage);
  const [editOpen, setEditOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(initialUsername);
  const [savePending, setSavePending] = useState(false);
  const [avatarUploadPending, setAvatarUploadPending] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameAvailabilityState>("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedDraftUsername = useMemo(() => normalizeUsername(usernameDraft), [usernameDraft]);
  const memberSince = useMemo(() => formatMemberSince(createdAt, timeZone), [createdAt, timeZone]);
  const avatarSeed = username || "anonymous";
  const avatarLabel = avatarSeed.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!editOpen) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }

    const usernameError = validateNormalizedUsername(normalizedDraftUsername);
    if (usernameError) {
      setUsernameStatus("invalid");
      setUsernameHint(usernameError);
      return;
    }

    if (normalizedDraftUsername === username) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setUsernameStatus("checking");
      setUsernameHint("checking availability...");

      try {
        const response = await fetch(`/api/username/check?username=${encodeURIComponent(normalizedDraftUsername)}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | { available?: boolean; normalized?: string; error?: string }
          | null;

        if (!response.ok) {
          setUsernameStatus("error");
          setUsernameHint(data?.error || "could not check username right now.");
          return;
        }

        if (data?.available) {
          setUsernameStatus("available");
          setUsernameHint(`${data.normalized || normalizedDraftUsername} is available.`);
          return;
        }

        setUsernameStatus("taken");
        setUsernameHint(data?.error || "username is taken.");
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setUsernameStatus("error");
        setUsernameHint("could not check username right now.");
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [editOpen, normalizedDraftUsername, username]);

  async function handleSignOut() {
    setSignOutPending(true);
    await signOut({ callbackUrl: "/" });
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== DELETE_CONFIRMATION_TEXT) {
      setDeleteError("type DELETE MY DATA to confirm.");
      return;
    }

    setDeleteError(null);
    setDeletePending(true);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });

      const data = (await response.json().catch(() => null)) as DeleteAccountResponse | null;
      if (!response.ok || !data?.ok) {
        setDeleteError(data?.error || "could not delete account right now.");
        return;
      }

      setDeleteSuccess(true);
      setDeleteOpen(false);
      await signOut({ redirect: false });
    } catch {
      setDeleteError("could not delete account right now.");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleSaveProfile() {
    const usernameError = validateNormalizedUsername(normalizedDraftUsername);
    if (usernameError) {
      setProfileError(usernameError);
      setProfileNotice(null);
      return;
    }

    if (usernameStatus === "taken") {
      setProfileError("username is taken");
      setProfileNotice(null);
      return;
    }

    setSavePending(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedDraftUsername,
        }),
      });
      const data = (await response.json().catch(() => null)) as UpdateProfileResponse | null;
      if (!response.ok || !data?.ok || !data.user?.username) {
        setProfileError(data?.error || "could not update profile.");
        return;
      }

      const nextUsername = data.user.username;
      setUsername(nextUsername);
      setUsernameDraft(nextUsername);
      setEditOpen(false);
      setUsernameStatus("idle");
      setUsernameHint(null);
      setProfileNotice("profile updated.");
    } catch {
      setProfileError("could not update profile.");
    } finally {
      setSavePending(false);
    }
  }

  async function handleAvatarFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setProfileError("select an image file.");
      setProfileNotice(null);
      return;
    }

    setProfileError(null);
    setProfileNotice(null);
    setAvatarCropFile(file);
    setAvatarCropOpen(true);
  }

  async function handleAvatarCropSave(imageDataUrl: string) {
    setAvatarUploadPending(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = (await response.json().catch(() => null)) as UpdateProfileResponse | null;
      if (!response.ok || !data?.ok) {
        setProfileError(data?.error || "could not update avatar.");
        return;
      }

      setImage(data?.user?.image ?? imageDataUrl);
      setProfileNotice("avatar updated.");
      setAvatarCropOpen(false);
      setAvatarCropFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "could not update avatar.";
      setProfileError(message);
      throw new Error(message);
    } finally {
      setAvatarUploadPending(false);
    }
  }

  function handleAvatarCropCancel() {
    if (avatarUploadPending) {
      return;
    }
    setAvatarCropOpen(false);
    setAvatarCropFile(null);
  }

  function resetProfileEdit() {
    setEditOpen(false);
    setUsernameDraft(username);
    setUsernameStatus("idle");
    setUsernameHint(null);
    setProfileError(null);
  }

  return (
    <div className="bw-profileWrap">
      <section className="bw-profileHeader" aria-label="profile header">
        <div className="bw-profileHeaderRow">
          <div className="bw-profileAvatarWrap">
            {image ? (
              // Data URLs are stored in User.image, so plain img avoids next/image remote constraints.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bw-profileAvatar" src={image} alt={`${username} avatar`} />
            ) : (
              <div className="bw-profileAvatar bw-profileAvatarFallback">
                <span className="bw-ui bw-date">{avatarLabel}</span>
              </div>
            )}
            {editOpen && (
              <button
                className="bw-profileAvatarBtn"
                type="button"
                disabled={avatarUploadPending}
                onClick={() => fileInputRef.current?.click()}
                aria-label="upload avatar image"
                title="change avatar"
              >
                {avatarUploadPending ? "..." : "+"}
              </button>
            )}
            <input
              ref={fileInputRef}
              className="bw-profileFileInput"
              type="file"
              accept="image/*"
              onChange={handleAvatarFileSelected}
            />
          </div>

          <div className="bw-profileIdentity">
            <div className="bw-profileIdentityTop">
              <h1 className="bw-profileName">@{username}</h1>
              <button
                className="bw-btnGhost"
                type="button"
                disabled={savePending || signOutPending || deletePending || avatarUploadPending}
                onClick={() => {
                  if (editOpen) {
                    resetProfileEdit();
                    return;
                  }
                  setEditOpen(true);
                  setProfileError(null);
                  setProfileNotice(null);
                }}
              >
                {editOpen ? "close edit" : "edit profile"}
              </button>
            </div>
            <div className="bw-ui bw-date">a quiet personal profile</div>
            {memberSince && <div className="bw-ui bw-date">member since {memberSince}</div>}
          </div>
        </div>

        {editOpen && (
          <div className="bw-profileEditArea">
            <input
              className="bw-input"
              type="text"
              autoComplete="username"
              placeholder="username"
              value={usernameDraft}
              onChange={(event) => setUsernameDraft(event.target.value.toLowerCase())}
            />
            {usernameHint && <div className="bw-hint">{usernameHint}</div>}
            <div className="bw-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <button className="bw-btnGhost" type="button" disabled={savePending || avatarUploadPending} onClick={() => void handleSaveProfile()}>
                {savePending ? "saving..." : "save profile"}
              </button>
              <button className="bw-btnGhost" type="button" disabled={savePending || avatarUploadPending} onClick={resetProfileEdit}>
                cancel
              </button>
            </div>
          </div>
        )}

        {profileNotice && <div className="bw-hint" style={{ marginTop: 10 }}>{profileNotice}</div>}
        {profileError && <div className="bw-hint" style={{ marginTop: 10 }}>{profileError}</div>}
      </section>

      <section className="bw-profileFeedSection" aria-label="shared entries">
        <div className="bw-ui bw-date" style={{ marginBottom: 10 }}>
          shared entries
        </div>
        <ProfileSharedEntriesFeed
          initialItems={initialSharedEntries}
          initialNextCursor={initialSharedEntriesNextCursor}
          timeZone={timeZone}
        />
      </section>

      <section className="bw-card bw-accountCard bw-profileAccountCard">
        <h2 className="bw-accountTitle" style={{ marginBottom: 10 }}>
          account
        </h2>

        <div className="bw-accountMeta">
          <div className="bw-accountRow">
            <span className="bw-date">created</span>
            <span className="bw-accountValue">{formatDate(createdAt, timeZone)}</span>
          </div>
          <div className="bw-accountRow">
            <span className="bw-date">email</span>
            <span className="bw-accountValue">{email}</span>
          </div>
          <div className="bw-accountRow">
            <span className="bw-date">verification</span>
            <span className="bw-accountValue">{emailVerified ? "verified" : "not verified"}</span>
          </div>
        </div>

        <div className="bw-accountActions">
          <button className="bw-btn" type="button" onClick={handleSignOut} disabled={signOutPending || deletePending}>
            {signOutPending ? "signing out..." : "sign out"}
          </button>
          <button
            className="bw-btnGhost"
            type="button"
            onClick={() => {
              setDeleteOpen((value) => !value);
              setDeleteError(null);
            }}
            disabled={deletePending || signOutPending || deleteSuccess}
          >
            delete account
          </button>
        </div>

        {deleteOpen && !deleteSuccess && (
          <div className="bw-accountDanger">
            <p className="bw-accountDangerText">
              this is permanent. type <strong>DELETE MY DATA</strong> to confirm.
            </p>
            <input
              className="bw-input"
              value={deleteConfirmation}
              onChange={(event) => {
                setDeleteConfirmation(event.target.value);
                setDeleteError(null);
              }}
              placeholder="DELETE MY DATA"
              autoComplete="off"
            />
            <div className="bw-accountActions">
              <button
                className="bw-btnGhost"
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                  setDeleteError(null);
                }}
                disabled={deletePending}
              >
                cancel
              </button>
              <button
                className="bw-btn"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletePending || deleteConfirmation !== DELETE_CONFIRMATION_TEXT}
              >
                {deletePending ? "deleting..." : "delete account"}
              </button>
            </div>
          </div>
        )}

        {deleteError && <div className="bw-hint">{deleteError}</div>}
        {deleteSuccess && <div className="bw-hint">your account has been deleted.</div>}
      </section>

      {avatarCropOpen && avatarCropFile && (
        <AvatarCropModal
          key={`${avatarCropFile.name}:${avatarCropFile.size}:${avatarCropFile.lastModified}`}
          open={avatarCropOpen}
          file={avatarCropFile}
          saving={avatarUploadPending}
          onCancel={handleAvatarCropCancel}
          onSave={handleAvatarCropSave}
        />
      )}
    </div>
  );
}
