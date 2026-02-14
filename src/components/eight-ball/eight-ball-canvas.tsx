"use client";

import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  forwardRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

const DEFAULT_TRANSITION_MS = 3500;
const REDUCED_TRANSITION_MS = 150;
// Cap DPR for stable performance on high-density screens while keeping the ball sharp.
const MAX_DPR = 1.8;
const PROMPT_CANVAS_SIZE = 1024;

type TransitionState = {
  active: boolean;
  reducedMotion: boolean;
  durationMs: number;
  startMs: number;
  resolve: (() => void) | null;
};

type InternalState = {
  pointerTargetX: number;
  pointerTargetY: number;
  pointerX: number;
  pointerY: number;
  elapsed: number;
  revealMix: number;
  transition: TransitionState;
};

export type EightBallCanvasHandle = {
  playTransition: (options?: { reducedMotion?: boolean; durationMs?: number }) => Promise<void>;
};

type EightBallCanvasProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  revealed: boolean;
  promptText: string;
  onPress: () => void;
  style?: CSSProperties;
  children?: ReactNode;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number): number {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(value: number): number {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function wrapPromptText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return ["listening..."];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const maxLines = 4;
  if (lines.length <= maxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, maxLines);
  let lastLine = trimmed[maxLines - 1];
  while (lastLine.length > 0 && context.measureText(`${lastLine}...`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }
  trimmed[maxLines - 1] = `${lastLine}...`;
  return trimmed;
}

function createPromptWindowTextureCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PROMPT_CANVAS_SIZE;
  canvas.height = PROMPT_CANVAS_SIZE;
  return canvas;
}

function drawPromptWindowTexture(canvas: HTMLCanvasElement, promptText: string) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  const inset = 122;
  const width = canvas.width - inset * 2;
  const height = canvas.height - inset * 2;

  drawRoundedRect(context, inset, inset, width, height, 112);
  context.fillStyle = "rgba(20, 20, 23, 0.93)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.1)";
  context.lineWidth = 8;
  context.stroke();

  context.fillStyle = "rgba(242, 242, 242, 0.9)";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "500 66px 'Helvetica Neue', Arial, sans-serif";

  const lines = wrapPromptText(context, promptText, width - 142);
  const lineHeight = 86;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });
}

function createEightDecalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("could not create decal canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.beginPath();
  context.arc(256, 256, 180, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 255, 255, 0.98)";
  context.fill();

  context.beginPath();
  context.arc(256, 256, 180, 0, Math.PI * 2);
  context.lineWidth = 8;
  context.strokeStyle = "rgba(220, 220, 220, 0.9)";
  context.stroke();

  context.fillStyle = "rgba(14, 14, 16, 0.98)";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 270px 'Helvetica Neue', Arial, sans-serif";
  context.fillText("8", 256, 282);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export const EightBallCanvas = forwardRef<EightBallCanvasHandle, EightBallCanvasProps>(
  function EightBallCanvas(
    { ariaLabel, className, disabled = false, revealed, promptText, onPress, style, children },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const revealedRef = useRef(revealed);
    const promptTextRef = useRef(promptText);
    const promptCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const promptTextureRef = useRef<THREE.CanvasTexture | null>(null);
    const stateRef = useRef<InternalState>({
      pointerTargetX: 0,
      pointerTargetY: 0,
      pointerX: 0,
      pointerY: 0,
      elapsed: 0,
      revealMix: 0,
      transition: {
        active: false,
        reducedMotion: false,
        durationMs: DEFAULT_TRANSITION_MS,
        startMs: 0,
        resolve: null,
      },
    });

    useImperativeHandle(ref, () => ({
      playTransition(options?: { reducedMotion?: boolean; durationMs?: number }) {
        const transition = stateRef.current.transition;
        if (transition.active) {
          return Promise.resolve();
        }
        const duration = options?.reducedMotion
          ? REDUCED_TRANSITION_MS
          : options?.durationMs ?? DEFAULT_TRANSITION_MS;

        transition.active = true;
        transition.reducedMotion = Boolean(options?.reducedMotion);
        transition.durationMs = duration;
        transition.startMs = performance.now();
        stateRef.current.pointerTargetX = 0;
        stateRef.current.pointerTargetY = 0;
        return new Promise<void>((resolve) => {
          transition.resolve = resolve;
        });
      },
    }), []);

    useEffect(() => {
      revealedRef.current = revealed;
    }, [revealed]);

    useEffect(() => {
      promptTextRef.current = promptText;
    }, [promptText]);

    useEffect(() => {
      const promptCanvas = promptCanvasRef.current;
      const promptTexture = promptTextureRef.current;
      if (!promptCanvas || !promptTexture) {
        return;
      }
      drawPromptWindowTexture(promptCanvas, promptText);
      promptTexture.needsUpdate = true;
    }, [promptText]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0, 5.2);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.34);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
      keyLight.position.set(2.2, 2.5, 4.8);
      const fillLight = new THREE.DirectionalLight(0xcfd5ff, 0.38);
      fillLight.position.set(-2.6, -1.1, 1.6);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.58);
      rimLight.position.set(-1.2, 3.2, -2.2);
      scene.add(ambientLight, keyLight, fillLight, rimLight);

      const root = new THREE.Group();
      scene.add(root);

      const sphereGeometry = new THREE.SphereGeometry(1, 128, 128);
      const sphereMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x121212,
        roughness: 0.11,
        metalness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.045,
        envMapIntensity: 1.28,
      });
      const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
      root.add(sphereMesh);

      const decalTexture = createEightDecalTexture();
      const decalGeometry = new DecalGeometry(
        sphereMesh,
        new THREE.Vector3(0, 0, 1.01),
        new THREE.Euler(0, 0, 0),
        new THREE.Vector3(0.86, 0.86, 0.32),
      );
      const decalMaterial = new THREE.MeshStandardMaterial({
        map: decalTexture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        roughness: 0.56,
        metalness: 0.05,
        opacity: 1,
      });
      const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
      root.add(decalMesh);

      const promptCanvas = createPromptWindowTextureCanvas();
      drawPromptWindowTexture(promptCanvas, promptTextRef.current);
      const promptTexture = new THREE.CanvasTexture(promptCanvas);
      promptTexture.colorSpace = THREE.SRGBColorSpace;
      promptTexture.needsUpdate = true;

      const promptDecalGeometry = new DecalGeometry(
        sphereMesh,
        new THREE.Vector3(0, 0, 1.015),
        new THREE.Euler(0, 0, 0),
        new THREE.Vector3(1.02, 1.02, 0.4),
      );
      const promptDecalMaterial = new THREE.MeshStandardMaterial({
        map: promptTexture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        roughness: 0.62,
        metalness: 0.05,
        opacity: 0,
      });
      const promptDecalMesh = new THREE.Mesh(promptDecalGeometry, promptDecalMaterial);
      promptDecalMesh.visible = false;
      root.add(promptDecalMesh);

      promptCanvasRef.current = promptCanvas;
      promptTextureRef.current = promptTexture;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnvironment = new RoomEnvironment();
      const envRenderTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
      scene.environment = envRenderTarget.texture;
      roomEnvironment.dispose();

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      resize();

      const resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(canvas);
      window.addEventListener("resize", resize);

      let rafId = 0;
      let previousSeconds = 0;
      let disposed = false;

      const animate = (timestampMs: number) => {
        if (disposed) {
          return;
        }

        const seconds = timestampMs * 0.001;
        const delta = previousSeconds ? Math.min(0.05, seconds - previousSeconds) : 0.016;
        previousSeconds = seconds;

        const state = stateRef.current;
        state.elapsed += delta;
        state.pointerX = THREE.MathUtils.damp(state.pointerX, state.pointerTargetX, 9, delta);
        state.pointerY = THREE.MathUtils.damp(state.pointerY, state.pointerTargetY, 9, delta);

        state.revealMix = THREE.MathUtils.damp(state.revealMix, revealedRef.current ? 1 : 0, 8.5, delta);
        decalMaterial.opacity = clamp(1 - state.revealMix, 0, 1);
        promptDecalMaterial.opacity = clamp(state.revealMix, 0, 1);
        decalMesh.visible = decalMaterial.opacity > 0.015;
        promptDecalMesh.visible = promptDecalMaterial.opacity > 0.015;

        const pointerX = state.pointerY * 0.2;
        const pointerY = state.pointerX * 0.24;

        let targetRotationX = 0;
        let targetRotationY = 0;
        let targetRotationZ = 0;
        let targetOffsetY = 0;
        let targetOffsetX = 0;
        let targetScaleX = 1;
        let targetScaleY = 1;
        let targetScaleZ = 1;

        if (state.transition.active) {
          const elapsedMs = timestampMs - state.transition.startMs;
          const progress = clamp(elapsedMs / state.transition.durationMs, 0, 1);

          if (state.transition.reducedMotion) {
            const pulse = easeOutCubic(progress);
            targetRotationY = pulse * 0.75;
            targetScaleX = 1 - pulse * 0.015;
            targetScaleY = 1 + pulse * 0.02;
            targetScaleZ = 1 - pulse * 0.015;
          } else {
            const anticipationProgress = clamp(progress / 0.08, 0, 1);
            const flightProgress = clamp((progress - 0.08) / 0.74, 0, 1);
            const settleProgress = clamp((progress - 0.82) / 0.18, 0, 1);

            const anticipation = easeOutCubic(anticipationProgress);
            const flight = easeInOutCubic(flightProgress);
            const spin = easeOutCubic(clamp((progress - 0.04) / 0.7, 0, 1));

            if (progress < 0.08) {
              targetOffsetY = -0.085 * anticipation;
              targetScaleX = 1 + 0.06 * anticipation;
              targetScaleY = 1 - 0.1 * anticipation;
              targetScaleZ = 1 + 0.06 * anticipation;
            } else {
              const jumpHeight = Math.sin(flight * Math.PI) * 0.62;
              const stretch = Math.sin(flight * Math.PI) * 0.06;
              const landingSettle =
                settleProgress > 0
                  ? Math.sin(settleProgress * Math.PI * 2.2) * 0.045 * (1 - settleProgress)
                  : 0;
              targetOffsetY = jumpHeight + landingSettle;
              targetOffsetX = Math.sin(state.elapsed * 18) * (1 - flight) * 0.045;
              targetScaleX = 1 - stretch * 0.48;
              targetScaleY = 1 + stretch;
              targetScaleZ = 1 - stretch * 0.48;
            }

            targetRotationX = spin * Math.PI * 2.25 + Math.sin(flight * Math.PI) * 0.22;
            targetRotationY = spin * Math.PI * 5.5 + Math.sin(flight * Math.PI * 2) * 0.1;
            targetRotationZ = spin * Math.PI * 1.7;
          }

          if (progress >= 1) {
            state.transition.active = false;
            const resolver = state.transition.resolve;
            state.transition.resolve = null;
            resolver?.();
          }
        } else if (revealedRef.current) {
          targetRotationX = 0;
          targetRotationY = 0;
          targetRotationZ = 0;
        } else {
          const idleRotationX = Math.sin(state.elapsed * 0.24) * 0.02;
          const idleRotationY = state.elapsed * 0.11;
          const idleRotationZ = Math.sin(state.elapsed * 0.18) * 0.008;
          targetRotationX = idleRotationX + pointerX;
          targetRotationY = idleRotationY + pointerY;
          targetRotationZ = idleRotationZ;
          targetOffsetY = Math.sin(state.elapsed * 0.31) * 0.012;
        }

        const rotationDamp = state.transition.active ? 12 : 8;
        const movementDamp = state.transition.active ? 11 : 9;
        root.rotation.x = THREE.MathUtils.damp(root.rotation.x, targetRotationX, rotationDamp, delta);
        root.rotation.y = THREE.MathUtils.damp(root.rotation.y, targetRotationY, rotationDamp, delta);
        root.rotation.z = THREE.MathUtils.damp(root.rotation.z, targetRotationZ, rotationDamp, delta);
        root.position.y = THREE.MathUtils.damp(root.position.y, targetOffsetY, movementDamp, delta);
        root.position.x = THREE.MathUtils.damp(root.position.x, targetOffsetX, movementDamp, delta);
        root.scale.x = THREE.MathUtils.damp(root.scale.x, targetScaleX, movementDamp, delta);
        root.scale.y = THREE.MathUtils.damp(root.scale.y, targetScaleY, movementDamp, delta);
        root.scale.z = THREE.MathUtils.damp(root.scale.z, targetScaleZ, movementDamp, delta);

        const idlePulse = revealedRef.current ? 0 : Math.sin(state.elapsed * 0.3) * 0.035;
        sphereMaterial.envMapIntensity = 1.22 + idlePulse;
        keyLight.intensity = 1.1 + (revealedRef.current ? 0 : Math.sin(state.elapsed * 0.28) * 0.06);

        renderer.render(scene, camera);
        rafId = window.requestAnimationFrame(animate);
      };

      rafId = window.requestAnimationFrame(animate);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        window.removeEventListener("resize", resize);

        // Explicitly dispose WebGL resources to prevent leaks during route transitions/remounts.
        decalGeometry.dispose();
        promptDecalGeometry.dispose();
        sphereGeometry.dispose();
        decalMaterial.dispose();
        promptDecalMaterial.dispose();
        sphereMaterial.dispose();
        decalTexture.dispose();
        promptTexture.dispose();
        envRenderTarget.dispose();
        pmremGenerator.dispose();

        renderer.renderLists.dispose();
        renderer.forceContextLoss();
        renderer.dispose();
      };
    }, []);

    function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (disabled || event.pointerType === "touch") {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const normalizedY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      stateRef.current.pointerTargetX = clamp(normalizedX, -1, 1);
      stateRef.current.pointerTargetY = clamp(normalizedY, -1, 1);
    }

    function handlePointerLeave() {
      stateRef.current.pointerTargetX = 0;
      stateRef.current.pointerTargetY = 0;
    }

    return (
      <button
        type="button"
        className={["bw-threeBallButton", className].filter(Boolean).join(" ")}
        style={style}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={onPress}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onBlur={handlePointerLeave}
      >
        <canvas ref={canvasRef} className="bw-threeBallCanvas" />
        {children}
      </button>
    );
  },
);
