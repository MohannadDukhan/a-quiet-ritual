"use client";

import { signOut } from "next-auth/react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

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
const AVATAR_DIMENSION = 320;
const AVATAR_TARGET_BYTES = 150 * 1024;
const AVATAR_MAX_BYTES = 250 * 1024;

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

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("could not read image file."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("could not process image."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("could not process image."));
    reader.readAsDataURL(blob);
  });
}

async function buildAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("select an image file.");
  }

  const image = await loadImageFromFile(file);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    throw new Error("could not read image size.");
  }

  const square = Math.min(width, height);
  const sx = Math.floor((width - square) / 2);
  const sy = Math.floor((height - square) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_DIMENSION;
  canvas.height = AVATAR_DIMENSION;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("could not prepare image.");
  }

  context.drawImage(image, sx, sy, square, square, 0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION);

  const encoders: Array<{ type: string; qualities: number[] }> = [
    { type: "image/webp", qualities: [0.9, 0.82, 0.74, 0.66, 0.58, 0.5] },
    { type: "image/jpeg", qualities: [0.88, 0.8, 0.72, 0.64, 0.56, 0.48] },
  ];

  let smallestBlob: Blob | null = null;
  for (const encoder of encoders) {
    for (const quality of encoder.qualities) {
      const blob = await canvasToBlob(canvas, encoder.type, quality);
      if (!blob) {
        continue;
      }

      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob;
      }

      if (blob.size <= AVATAR_TARGET_BYTES) {
        return blobToDataUrl(blob);
      }
    }
  }

  if (!smallestBlob) {
    throw new Error("could not process image.");
  }
  if (smallestBlob.size > AVATAR_MAX_BYTES) {
    throw new Error("avatar image must be 250kb or less.");
  }

  return blobToDataUrl(smallestBlob);
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

    setAvatarUploadPending(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const imageDataUrl = await buildAvatarDataUrl(file);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "could not update avatar.";
      setProfileError(message);
    } finally {
      setAvatarUploadPending(false);
    }
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
    </div>
  );
}
