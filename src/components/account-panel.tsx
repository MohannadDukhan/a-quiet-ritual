"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { formatDate } from "@/lib/time";

type AccountPanelProps = {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  timeZone: string;
};

type DeleteAccountResponse = {
  ok?: boolean;
  error?: string;
};

const DELETE_CONFIRMATION_TEXT = "DELETE MY DATA";

function maskEmail(email: string): string {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) return email;
  const stars = "*".repeat(Math.max(3, Math.min(8, localPart.length - 1)));
  return `${localPart.slice(0, 1)}${stars}@${domainPart}`;
}

export function AccountPanel({ createdAt, email, emailVerified, timeZone }: AccountPanelProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);

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

  return (
    <div className="bw-card bw-accountCard">
      <h1 className="bw-accountTitle">account</h1>

      <div className="bw-accountMeta">
        <div className="bw-accountRow">
          <span className="bw-date">created</span>
          <span className="bw-accountValue">{formatDate(createdAt, timeZone)}</span>
        </div>
        <div className="bw-accountRow">
          <span className="bw-date">email</span>
          <span className="bw-accountValue">{maskEmail(email)}</span>
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
    </div>
  );
}
