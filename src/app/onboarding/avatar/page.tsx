"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { AvatarCropModal } from "@/components/profile/AvatarCropModal";
import { BwNavButton } from "@/components/ui/bw-nav-button";

type ProfileResponse = {
  ok?: boolean;
  error?: string;
  user?: {
    username?: string | null;
    image?: string | null;
  };
};

export default function OnboardingAvatarPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [image, setImage] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?next=/onboarding/username");
      return;
    }
    if (status === "authenticated" && !session?.user?.username) {
      router.replace("/onboarding/username");
    }
  }, [router, session?.user?.username, status]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile/update", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as ProfileResponse | null;
        if (!response.ok || cancelled) {
          return;
        }
        setImage(data?.user?.image ?? null);
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    if (status === "authenticated" && session?.user?.username) {
      void loadProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [session?.user?.username, status]);

  async function handleAvatarFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("select an image file.");
      return;
    }

    setError(null);
    setAvatarCropFile(file);
    setAvatarCropOpen(true);
  }

  async function handleAvatarCropSave(imageDataUrl: string) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "could not update avatar.");
        return;
      }

      setImage(data?.user?.image ?? imageDataUrl);
      setAvatarCropOpen(false);
      setAvatarCropFile(null);
    } catch {
      setError("could not update avatar.");
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarCropCancel() {
    if (saving) {
      return;
    }
    setAvatarCropOpen(false);
    setAvatarCropFile(null);
  }

  function goNext() {
    router.push("/onboarding/anonymous");
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/onboarding/username">
          back
        </BwNavButton>
        <span className="bw-topLabel">onboarding 2 / 4</span>
        <BwNavButton href="/">
          skip all
        </BwNavButton>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <h1 className="bw-authTitle">profile picture</h1>
          <p className="bw-authLead">optional. upload one now or skip.</p>

          <div className="bw-profileAvatarWrap" style={{ margin: "0 auto" }}>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bw-profileAvatar" src={image} alt="avatar preview" />
            ) : (
              <div className="bw-profileAvatar bw-profileAvatarFallback">
                <span className="bw-ui bw-date">
                  {(session?.user?.username || "a").slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            className="bw-profileFileInput"
            type="file"
            accept="image/*"
            onChange={handleAvatarFileSelected}
          />

          <div className="bw-row" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <button className="bw-btnGhost" type="button" disabled={saving || loadingProfile} onClick={() => fileInputRef.current?.click()}>
              {saving ? "saving..." : "upload"}
            </button>
            <button className="bw-btnGhost" type="button" onClick={goNext} disabled={saving || loadingProfile}>
              skip
            </button>
            <button className="bw-btn" type="button" onClick={goNext} disabled={loadingProfile || saving}>
              next
            </button>
          </div>

          {error && <div className="bw-hint">{error}</div>}
        </div>
      </main>

      {avatarCropOpen && avatarCropFile && (
        <AvatarCropModal
          key={`${avatarCropFile.name}:${avatarCropFile.size}:${avatarCropFile.lastModified}`}
          open={avatarCropOpen}
          file={avatarCropFile}
          saving={saving}
          onCancel={handleAvatarCropCancel}
          onSave={handleAvatarCropSave}
        />
      )}
    </div>
  );
}
