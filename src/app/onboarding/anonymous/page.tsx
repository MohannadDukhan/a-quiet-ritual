"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

type SettingsResponse = {
  ok?: boolean;
  error?: string;
  settings?: {
    collectiveAnonymous?: boolean;
  };
};

export default function OnboardingAnonymousPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collectiveAnonymous, setCollectiveAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?next=/onboarding/username");
      setLoading(false);
    }
  }, [router, status]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const profileResponse = await fetch("/api/profile/update", {
          method: "GET",
          cache: "no-store",
        });
        const profileData = (await profileResponse.json().catch(() => null)) as
          | { user?: { username?: string | null } }
          | null;
        if (!profileResponse.ok || cancelled) {
          return;
        }
        if (!profileData?.user?.username) {
          router.replace("/onboarding/username");
          return;
        }

        const response = await fetch("/api/profile/settings", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as SettingsResponse | null;
        if (!response.ok || cancelled) {
          return;
        }
        setCollectiveAnonymous(Boolean(data?.settings?.collectiveAnonymous));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (status === "authenticated") {
      void loadSettings();
    }

    return () => {
      cancelled = true;
    };
  }, [router, status]);

  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectiveAnonymous }),
      });
      const data = (await response.json().catch(() => null)) as SettingsResponse | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "could not save setting.");
        return;
      }
      router.push("/onboarding/tone");
    } catch {
      setError("could not save setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/onboarding/avatar">
          back
        </BwNavButton>
        <span className="bw-topLabel">onboarding 3 / 4</span>
        <BwNavButton href="/">
          skip all
        </BwNavButton>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <h1 className="bw-authTitle">collective anonymity</h1>
          <p className="bw-authLead">optional. choose how your shared prompt posts appear.</p>

          <label className="bw-ui bw-checkLabel" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <input
              className="bw-checkbox"
              type="checkbox"
              checked={collectiveAnonymous}
              disabled={loading || saving}
              onChange={(event) => setCollectiveAnonymous(event.target.checked)}
            />
            <span>post anonymously on collective</span>
          </label>
          <div className="bw-hint">when enabled, your shared prompt entries show as anonymous to users.</div>

          <div className="bw-row" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <button className="bw-btnGhost" type="button" onClick={() => router.push("/onboarding/tone")} disabled={loading || saving}>
              skip
            </button>
            <button className="bw-btn" type="button" onClick={() => void saveAndContinue()} disabled={loading || saving}>
              {saving ? "saving..." : "next"}
            </button>
          </div>
          {error && <div className="bw-hint">{error}</div>}
        </div>
      </main>
    </div>
  );
}
