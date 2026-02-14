"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { formatDate, formatDateTime } from "@/lib/time";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

type SharedProfileEntry = {
  id: string;
  content: string;
  createdAt: string;
};

type AccountPanelProps = {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  timeZone: string;
  initialUsername: string;
  initialImage: string | null;
  sharedEntries: SharedProfileEntry[];
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
const PREVIEW_LENGTH = 140;

function previewText(value: string, maxLength: number = PREVIEW_LENGTH): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength).trimEnd()}...`;
}

export function AccountPanel({
  createdAt,
  email,
  emailVerified,
  timeZone,
  initialUsername,
  initialImage,
  sharedEntries,
}: AccountPanelProps) {
  const [username, setUsername] = useState(initialUsername);
  const [image, setImage] = useState(initialImage);
  const [editOpen, setEditOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(initialUsername);
  const [imageDraft, setImageDraft] = useState(initialImage ?? "");
  const [savePending, setSavePending] = useState(false);
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

  const normalizedDraftUsername = useMemo(() => normalizeUsername(usernameDraft), [usernameDraft]);
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
          image: imageDraft,
        }),
      });
      const data = (await response.json().catch(() => null)) as UpdateProfileResponse | null;
      if (!response.ok || !data?.ok || !data.user?.username) {
        setProfileError(data?.error || "could not update profile.");
        return;
      }

      const nextUsername = data.user.username;
      const nextImage = data.user.image ?? null;
      setUsername(nextUsername);
      setImage(nextImage);
      setUsernameDraft(nextUsername);
      setImageDraft(nextImage || "");
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

  function resetProfileEdit() {
    setEditOpen(false);
    setUsernameDraft(username);
    setImageDraft(image || "");
    setUsernameStatus("idle");
    setUsernameHint(null);
    setProfileError(null);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="bw-card bw-accountCard">
        <div className="bw-row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              aria-hidden="true"
              style={{
                width: 68,
                height: 68,
                borderRadius: "999px",
                border: "1px solid var(--bw-line)",
                backgroundColor: "var(--bw-panel)",
                backgroundImage: image ? `url("${image}")` : undefined,
                backgroundPosition: "center",
                backgroundSize: "cover",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {!image && <span className="bw-ui bw-date">{avatarLabel}</span>}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <h1 className="bw-accountTitle" style={{ marginBottom: 0 }}>
                @{username}
              </h1>
              <div className="bw-ui bw-date">a quiet personal profile</div>
            </div>
          </div>
          <button
            className="bw-btnGhost"
            type="button"
            disabled={savePending || signOutPending || deletePending}
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

        {editOpen && (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <input
              className="bw-input"
              type="text"
              autoComplete="username"
              placeholder="username"
              value={usernameDraft}
              onChange={(event) => setUsernameDraft(event.target.value.toLowerCase())}
            />
            {usernameHint && <div className="bw-hint">{usernameHint}</div>}
            <input
              className="bw-input"
              type="url"
              autoComplete="url"
              placeholder="profile image url (https://...)"
              value={imageDraft}
              onChange={(event) => setImageDraft(event.target.value)}
            />
            <div className="bw-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <button className="bw-btnGhost" type="button" disabled={savePending} onClick={() => void handleSaveProfile()}>
                {savePending ? "saving..." : "save profile"}
              </button>
              <button className="bw-btnGhost" type="button" disabled={savePending} onClick={resetProfileEdit}>
                cancel
              </button>
            </div>
          </div>
        )}

        {profileNotice && <div className="bw-hint" style={{ marginTop: 12 }}>{profileNotice}</div>}
        {profileError && <div className="bw-hint" style={{ marginTop: 12 }}>{profileError}</div>}
      </section>

      <section className="bw-card">
        <div className="bw-ui bw-date" style={{ marginBottom: 12 }}>
          shared entries
        </div>
        {sharedEntries.length === 0 ? (
          <div className="bw-hint">no shared entries yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sharedEntries.map((entry) => (
              <Link key={entry.id} href={`/collective/${entry.id}`} className="bw-card bw-cardLink">
                <div className="bw-cardMeta">
                  <div className="bw-ui bw-cardDate">{formatDateTime(entry.createdAt, timeZone)}</div>
                  <span className="bw-ui bw-collectiveBadge">shared</span>
                </div>
                <div className="bw-writing bw-cardText bw-cardPreview">{previewText(entry.content)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bw-card bw-accountCard">
        <h2 className="bw-accountTitle" style={{ marginBottom: 12 }}>
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
