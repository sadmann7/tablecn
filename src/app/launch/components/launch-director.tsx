"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const DEFAULT_ZOOM = 1.6;
/** Most of the cursor's 420ms glide, so the highlight lands as it arrives. */
const CURSOR_HOVER_DELAY = 260;
const CAMERA_EXIT_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

interface LaunchFocusOptions {
  scale?: number;
  /** Shifts the focus point from the target's center, in rem. */
  offsetX?: number;
  offsetY?: number;
}

export interface LaunchDirector {
  focus: (
    target: Element | null | undefined,
    options?: LaunchFocusOptions,
  ) => void;
  zoomOut: () => void;
  moveCursor: (target: Element | null | undefined) => void;
  click: (target: Element | null | undefined) => void;
  reset: (duration?: number) => void;
}

interface LaunchDirectorRefs {
  stage: React.RefObject<HTMLDivElement | null>;
  camera: React.RefObject<HTMLDivElement | null>;
  overlay: React.RefObject<HTMLDivElement | null>;
  overlayCamera: React.RefObject<HTMLDivElement | null>;
  cursor: React.RefObject<HTMLDivElement | null>;
  pointer: React.RefObject<SVGSVGElement | null>;
  ripple: React.RefObject<HTMLSpanElement | null>;
}

export function useLaunchDirector() {
  const stage = React.useRef<HTMLDivElement>(null);
  const camera = React.useRef<HTMLDivElement>(null);
  const overlay = React.useRef<HTMLDivElement>(null);
  const overlayCamera = React.useRef<HTMLDivElement>(null);
  const cursor = React.useRef<HTMLDivElement>(null);
  const pointer = React.useRef<SVGSVGElement>(null);
  const ripple = React.useRef<HTMLSpanElement>(null);
  const [refs] = React.useState<LaunchDirectorRefs>(() => ({
    stage,
    camera,
    overlay,
    overlayCamera,
    cursor,
    pointer,
    ripple,
  }));
  const [director] = React.useState(() => createLaunchDirector(refs));

  React.useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    // Menus portal to document.body, outside the stage's dark class.
    root.classList.add("dark");
    root.dataset.launchCamera = "";

    return () => {
      if (!hadDark) root.classList.remove("dark");
      delete root.dataset.launchCamera;
      root.style.removeProperty("--launch-camera-scale");
    };
  }, []);

  return { director, refs };
}

interface LaunchCameraProps {
  refs: LaunchDirectorRefs;
  children: React.ReactNode;
}

export function LaunchCamera({ refs, children }: LaunchCameraProps) {
  const isMounted = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  return (
    <div ref={refs.camera} className="launch-camera absolute inset-0">
      {children}
      {isMounted &&
        createPortal(<LaunchCursorOverlay refs={refs} />, document.body)}
    </div>
  );
}

function LaunchCursorOverlay({ refs }: { refs: LaunchDirectorRefs }) {
  return (
    <div
      ref={refs.overlay}
      className="pointer-events-none fixed top-0 left-0 z-51 overflow-hidden"
    >
      <div ref={refs.overlayCamera} className="launch-camera absolute inset-0">
        <div
          ref={refs.cursor}
          className="launch-cursor absolute top-0 left-0 opacity-0"
        >
          <span
            ref={refs.ripple}
            className="absolute -top-3.5 -left-3.5 size-7 rounded-full border border-white/80 opacity-0"
          />
          <svg
            ref={refs.pointer}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="-mt-1 -ml-2 size-9 origin-top-left drop-shadow-[0_0.25rem_0.5rem_rgb(0_0_0/0.5)]"
          >
            <path
              d="M5.5 3v16.5l4.4-4.2 2.8 6.4 2.7-1.2-2.8-6.3H19z"
              fill="white"
              stroke="black"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// The cursor is only drawn, so menus that highlight the item under the pointer need the events a real mouse sends
function hover(target: Element | null | undefined) {
  if (!target?.isConnected) return;

  const rect = target.getBoundingClientRect();
  const init: PointerEventInit = {
    bubbles: true,
    pointerType: "mouse",
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  target.dispatchEvent(new PointerEvent("pointerover", init));
  target.dispatchEvent(new PointerEvent("pointermove", init));
}

function createLaunchDirector(refs: LaunchDirectorRefs): LaunchDirector {
  function getCameraPoint(target: Element | null | undefined) {
    const stage = refs.stage.current;
    const camera = refs.camera.current;
    if (!stage || !camera || !target) return null;

    const stageRect = stage.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const transform = getComputedStyle(camera).transform;
    const matrix =
      transform === "none" ? new DOMMatrix() : new DOMMatrix(transform);

    return matrix
      .inverse()
      .transformPoint(
        new DOMPoint(
          rect.left + rect.width / 2 - stageRect.left,
          rect.top + rect.height / 2 - stageRect.top,
        ),
      );
  }

  function syncOverlay() {
    const stage = refs.stage.current;
    const overlay = refs.overlay.current;
    if (!stage || !overlay) return;

    const rect = stage.getBoundingClientRect();
    overlay.style.translate = `${rect.left}px ${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function setCamera(scale: number, x: number, y: number, duration?: number) {
    const root = document.documentElement;
    if (duration === undefined) {
      root.style.removeProperty("--launch-camera-duration");
      root.style.removeProperty("--launch-camera-ease");
    } else {
      root.style.setProperty("--launch-camera-duration", `${duration}ms`);
      root.style.setProperty("--launch-camera-ease", CAMERA_EXIT_EASE);
    }

    const transform = `translate(${x}px, ${y}px) scale(${scale})`;
    for (const layer of [refs.camera.current, refs.overlayCamera.current]) {
      if (layer) layer.style.transform = transform;
    }
    document.documentElement.style.setProperty(
      "--launch-camera-scale",
      String(scale),
    );
    const stage = refs.stage.current;
    if (stage) stage.dataset.zoomed = String(scale > 1);
  }

  let hoverTimeout = 0;

  function moveCursor(target: Element | null | undefined) {
    const cursor = refs.cursor.current;
    const point = getCameraPoint(target);
    if (!cursor || !point) return;

    syncOverlay();
    const isHidden = cursor.style.opacity !== "1";
    if (isHidden) cursor.style.transition = "none";
    cursor.style.translate = `${point.x}px ${point.y}px`;
    if (isHidden) {
      // Commits the jump before transitions return, so it fades in in place.
      void cursor.offsetWidth;
      cursor.style.transition = "";
    }
    cursor.style.opacity = "1";

    // Lands as the cursor glides into place
    window.clearTimeout(hoverTimeout);
    hoverTimeout = window.setTimeout(
      () => hover(target),
      isHidden ? 0 : CURSOR_HOVER_DELAY,
    );
  }

  return {
    focus(target, { scale = DEFAULT_ZOOM, offsetX = 0, offsetY = 0 } = {}) {
      const camera = refs.camera.current;
      const point = getCameraPoint(target);
      if (!camera || !point) return;

      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const { offsetWidth: width, offsetHeight: height } = camera;

      setCamera(
        scale,
        clamp(
          width / 2 - (point.x + offsetX * rem) * scale,
          width * (1 - scale),
          0,
        ),
        clamp(
          height / 2 - (point.y + offsetY * rem) * scale,
          height * (1 - scale),
          0,
        ),
      );
    },
    zoomOut() {
      setCamera(1, 0, 0);
    },
    moveCursor,
    click(target) {
      moveCursor(target);
      window.clearTimeout(hoverTimeout);
      hover(target);
      refs.pointer.current?.animate(
        [{ scale: "1" }, { scale: "0.82" }, { scale: "1" }],
        { duration: 200, easing: "ease-out" },
      );
      refs.ripple.current?.animate(
        [
          { opacity: 0.6, scale: "0.2" },
          { opacity: 0, scale: "1.4" },
        ],
        { duration: 360, easing: "ease-out" },
      );
    },
    reset(duration?: number) {
      window.clearTimeout(hoverTimeout);
      setCamera(1, 0, 0, duration);
      const cursor = refs.cursor.current;
      if (!cursor) return;

      if (duration !== undefined) {
        cursor.style.transition = `opacity ${duration}ms var(--launch-camera-ease, ease)`;
      }
      cursor.style.opacity = "0";
    },
  };
}

function subscribeToNothing() {
  return () => {};
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
