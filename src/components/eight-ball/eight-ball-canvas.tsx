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
  transition: TransitionState;
};

export type EightBallCanvasHandle = {
  playTransition: (options?: { reducedMotion?: boolean; durationMs?: number }) => Promise<void>;
};

type EightBallCanvasProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
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
    { ariaLabel, className, disabled = false, onPress, style, children },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const stateRef = useRef<InternalState>({
      pointerTargetX: 0,
      pointerTargetY: 0,
      pointerX: 0,
      pointerY: 0,
      elapsed: 0,
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
      });
      const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
      root.add(decalMesh);

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

        const idleX = Math.sin(state.elapsed * 0.42) * 0.045;
        const idleY = state.elapsed * 0.24;
        const pointerX = state.pointerY * 0.26;
        const pointerY = state.pointerX * 0.3;

        let rotationX = idleX + pointerX;
        let rotationY = idleY + pointerY;
        let rotationZ = Math.sin(state.elapsed * 0.3) * 0.01;
        let scale = 1;
        let offsetY = Math.sin(state.elapsed * 0.66) * 0.03;
        let offsetX = 0;
        let canvasOpacity = 1;

        if (state.transition.active) {
          const elapsedMs = timestampMs - state.transition.startMs;
          const progress = clamp(elapsedMs / state.transition.durationMs, 0, 1);

          if (state.transition.reducedMotion) {
            const fade = easeOutCubic(progress);
            scale = 1 + fade * 0.06;
            rotationY += fade * 0.9;
            canvasOpacity = 1 - fade;
          } else {
            const spinProgress = easeOutCubic(clamp(progress / 0.34, 0, 1));
            const pushProgress = easeInOutCubic(clamp((progress - 0.22) / 0.56, 0, 1));
            const fadeProgress = clamp((progress - 0.84) / 0.16, 0, 1);

            rotationX = 0.18 + spinProgress * 7.1 + pushProgress * 1.3;
            rotationY = spinProgress * 12.8 + pushProgress * 4.8;
            rotationZ = spinProgress * 7.9 + pushProgress * 2.5;
            scale = 1 + pushProgress * 0.78;
            offsetY = -pushProgress * 0.62;
            offsetX = Math.sin(state.elapsed * 20) * (1 - pushProgress) * 0.05;
            canvasOpacity = 1 - easeInOutCubic(fadeProgress);
          }

          if (progress >= 1) {
            state.transition.active = false;
            const resolver = state.transition.resolve;
            state.transition.resolve = null;
            resolver?.();
          }
        }

        root.rotation.set(rotationX, rotationY, rotationZ);
        root.scale.setScalar(scale);
        root.position.set(offsetX, offsetY, 0);
        canvas.style.opacity = String(canvasOpacity);

        sphereMaterial.envMapIntensity = 1.22 + Math.sin(state.elapsed * 0.6) * 0.05;
        keyLight.intensity = 1.12 + Math.sin(state.elapsed * 0.38) * 0.06;

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
        sphereGeometry.dispose();
        decalMaterial.dispose();
        sphereMaterial.dispose();
        decalTexture.dispose();
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
