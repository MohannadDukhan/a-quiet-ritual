"use client";

import Cropper, { Area } from "react-easy-crop";
import { useEffect, useMemo, useState } from "react";

import { cropImageToAvatarDataUrl } from "@/lib/image/crop-image";

type AvatarCropModalProps = {
  open: boolean;
  file: File | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (dataUrl: string) => Promise<void>;
};

export function AvatarCropModal({ open, file, saving, onCancel, onSave }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageSourceUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!imageSourceUrl) return;
    return () => URL.revokeObjectURL(imageSourceUrl);
  }, [imageSourceUrl]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSave() {
    if (!imageSourceUrl || !cropPixels) {
      setError("adjust the crop before saving.");
      return;
    }
    setError(null);
    try {
      const dataUrl = await cropImageToAvatarDataUrl(imageSourceUrl, cropPixels);
      await onSave(dataUrl);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "could not process image.";
      setError(message);
    }
  }

  if (!open || !imageSourceUrl) {
    return null;
  }

  return (
    <div className="bw-uiModalOverlay" onMouseDown={onCancel}>
      <div className="bw-uiModal bw-avatarCropModal" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="bw-uiModalX" aria-label="close cropper" onClick={onCancel} disabled={saving}>
          x
        </button>
        <h2 className="bw-uiModalTitle">crop avatar</h2>
        <p className="bw-uiModalBody">drag and zoom to fit the frame.</p>

        <div className="bw-avatarCropFrame">
          <Cropper
            image={imageSourceUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            zoomWithScroll
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPixels) => setCropPixels(croppedAreaPixels)}
          />
        </div>

        <div className="bw-avatarCropControls">
          <label className="bw-ui bw-date" htmlFor="avatar-crop-zoom">
            zoom
          </label>
          <input
            id="avatar-crop-zoom"
            className="bw-avatarCropSlider"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </div>

        {error && <div className="bw-hint">{error}</div>}

        <div className="bw-uiModalActions">
          <button type="button" className="bw-navbtn bw-navbtn-hover bw-uiModalSecondary" onClick={onCancel} disabled={saving}>
            cancel
          </button>
          <button type="button" className="bw-navbtn bw-navbtn-hover bw-uiModalPrimary" onClick={() => void handleSave()} disabled={saving || !cropPixels}>
            {saving ? "saving..." : "save"}
          </button>
        </div>
      </div>
    </div>
  );
}
