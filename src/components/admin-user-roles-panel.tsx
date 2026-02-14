"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AdminUserRolesPanelProps = {
  initialAdmins: string[];
};

type ApiResponse = {
  error?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function parseApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiResponse | null;
  return data?.error || "request failed.";
}

export function AdminUserRolesPanel({ initialAdmins }: AdminUserRolesPanelProps) {
  const [emailInput, setEmailInput] = useState("");
  const [admins, setAdmins] = useState(initialAdmins);
  const [pendingAction, setPendingAction] = useState<"grant" | "revoke" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => normalizeEmail(emailInput), [emailInput]);
  const busy = pendingAction !== null;

  async function runRoleAction(action: "grant" | "revoke") {
    if (!normalizedEmail) {
      setError("email is required.");
      setNotice(null);
      return;
    }

    setPendingAction(action);
    setNotice(null);
    setError(null);

    const url = action === "grant" ? "/api/admin/users/grant-admin" : "/api/admin/users/revoke-admin";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setAdmins((previous) => {
        if (action === "grant") {
          if (previous.includes(normalizedEmail)) {
            return previous;
          }
          return [...previous, normalizedEmail].sort((left, right) => left.localeCompare(right));
        }
        return previous.filter((value) => value !== normalizedEmail);
      });

      setNotice(action === "grant" ? "admin role granted." : "admin role revoked.");
      setEmailInput(normalizedEmail);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "request failed.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="bw-card">
        <div className="bw-row" style={{ marginBottom: 12, gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <h1 className="bw-accountTitle" style={{ marginBottom: 0 }}>
            user roles
          </h1>
          <Link className="bw-btnGhost" href="/admin">
            back to admin
          </Link>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label className="bw-ui bw-date" htmlFor="admin-role-email">
            email
          </label>
          <input
            id="admin-role-email"
            className="bw-input"
            type="email"
            value={emailInput}
            placeholder="user@email.com"
            autoComplete="off"
            onChange={(event) => {
              setEmailInput(event.target.value.toLowerCase());
              setNotice(null);
              setError(null);
            }}
            onBlur={() => setEmailInput(normalizeEmail(emailInput))}
          />
          <div className="bw-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <button
              className="bw-btnGhost"
              type="button"
              disabled={busy}
              onClick={() => {
                void runRoleAction("grant");
              }}
            >
              {pendingAction === "grant" ? "granting..." : "grant admin"}
            </button>
            <button
              className="bw-btnDanger"
              type="button"
              disabled={busy}
              onClick={() => {
                void runRoleAction("revoke");
              }}
            >
              {pendingAction === "revoke" ? "revoking..." : "revoke admin"}
            </button>
          </div>
          <div className="bw-hint" role={error ? "alert" : "status"} aria-live="polite">
            {error || notice || " "}
          </div>
        </div>
      </section>

      <section className="bw-card">
        <div className="bw-ui bw-date" style={{ marginBottom: 12 }}>
          current admins
        </div>
        {admins.length === 0 ? (
          <div className="bw-hint">no admins found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {admins.map((email) => (
              <div key={email} className="bw-accountRow">
                <span className="bw-accountValue">{email}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
