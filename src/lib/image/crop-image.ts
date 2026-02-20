const AVATAR_DEFAULT_SIZE = 512;
const AVATAR_MAX_BYTES = 250 * 1024;

type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropImageOptions = {
  outputSize?: number;
  maxBytes?: number;
};

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not process image."));
    image.src = sourceUrl;
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
      if (typeof reader.result !== "string") {
        reject(new Error("could not process image."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("could not process image."));
    reader.readAsDataURL(blob);
  });
}

function normalizeCropArea(cropAreaPixels: CropAreaPixels, imageWidth: number, imageHeight: number): CropAreaPixels {
  const width = Math.max(1, Math.round(cropAreaPixels.width));
  const height = Math.max(1, Math.round(cropAreaPixels.height));
  const x = Math.min(Math.max(0, Math.round(cropAreaPixels.x)), Math.max(0, imageWidth - width));
  const y = Math.min(Math.max(0, Math.round(cropAreaPixels.y)), Math.max(0, imageHeight - height));

  return { x, y, width, height };
}

export async function cropImageToAvatarDataUrl(
  sourceUrl: string,
  cropAreaPixels: CropAreaPixels,
  options?: CropImageOptions,
): Promise<string> {
  const outputSize = options?.outputSize ?? AVATAR_DEFAULT_SIZE;
  const maxBytes = options?.maxBytes ?? AVATAR_MAX_BYTES;
  const image = await loadImage(sourceUrl);
  const cropArea = normalizeCropArea(cropAreaPixels, image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("could not prepare image.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];
  let smallestBlob: Blob | null = null;
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) {
      continue;
    }

    if (!smallestBlob || blob.size < smallestBlob.size) {
      smallestBlob = blob;
    }

    if (blob.size <= maxBytes) {
      return blobToDataUrl(blob);
    }
  }

  if (!smallestBlob) {
    throw new Error("could not process image.");
  }
  if (smallestBlob.size > maxBytes) {
    throw new Error("avatar image must be 250kb or less.");
  }

  return blobToDataUrl(smallestBlob);
}
