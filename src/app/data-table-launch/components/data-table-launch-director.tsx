"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const DEFAULT_ZOOM = 1.6;
const CURSOR_HOVER_DELAY = 260;

interface DataTableLaunchFocusOptions {
  scale?: number;
  /** Shifts the focus point from the target's center, in rem. */
  offsetX?: number;
  offsetY?: number;
}

export interface DataTableLaunchDirector {
  focus: (
    target: Element | null | undefined,
    options?: DataTableLaunchFocusOptions,
  ) => void;
  zoomOut: () => void;
  moveCursor: (target: Element | null | undefined) => void;
  click: (target: Element | null | undefined) => void;
  reset: () => void;
}

interface DataTableLaunchElements {
  stage: HTMLDivElement | null;
  camera: HTMLDivElement | null;
  overlay: HTMLDivElement | null;
  overlayCamera: HTMLDivElement | null;
  cursor: HTMLDivElement | null;
  pointer: SVGSVGElement | null;
  ripple: HTMLSpanElement | null;
}

type DataTableLaunchDirectorAttach = {
  [K in keyof DataTableLaunchElements]: (
    element: DataTableLaunchElements[K],
  ) => void;
};

export function useDataTableLaunchDirector() {
  const [{ director, attach }] = React.useState(createLaunchDirector);

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

  return { director, attach };
}

interface DataTableLaunchCameraProps {
  attach: DataTableLaunchDirectorAttach;
  children: React.ReactNode;
}

export function DataTableLaunchCamera({
  attach,
  children,
}: DataTableLaunchCameraProps) {
  const isMounted = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const { camera } = attach;

  return (
    <div ref={camera} className="launch-camera absolute inset-0">
      {children}
      {isMounted &&
        createPortal(
          <DataTableLaunchCursorOverlay attach={attach} />,
          document.body,
        )}
    </div>
  );
}

function createLaunchDirector() {
  const elements: DataTableLaunchElements = {
    stage: null,
    camera: null,
    overlay: null,
    overlayCamera: null,
    cursor: null,
    pointer: null,
    ripple: null,
  };

  function setElement<K extends keyof DataTableLaunchElements>(key: K) {
    return (element: DataTableLaunchElements[K]) => {
      elements[key] = element;
    };
  }

  const attach: DataTableLaunchDirectorAttach = {
    stage: setElement("stage"),
    camera: setElement("camera"),
    overlay: setElement("overlay"),
    overlayCamera: setElement("overlayCamera"),
    cursor: setElement("cursor"),
    pointer: setElement("pointer"),
    ripple: setElement("ripple"),
  };

  function getCameraPoint(target: Element | null | undefined) {
    const { stage, camera } = elements;
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
    const { stage, overlay } = elements;
    if (!stage || !overlay) return;

    const rect = stage.getBoundingClientRect();
    overlay.style.translate = `${rect.left}px ${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function setCamera(scale: number, x: number, y: number) {
    const transform = `translate(${x}px, ${y}px) scale(${scale})`;
    for (const layer of [elements.camera, elements.overlayCamera]) {
      if (layer) layer.style.transform = transform;
    }
    document.documentElement.style.setProperty(
      "--launch-camera-scale",
      String(scale),
    );
    const { stage } = elements;
    if (stage) stage.dataset.zoomed = String(scale > 1);
  }

  let hoverTimeout = 0;

  function moveCursor(target: Element | null | undefined) {
    const { cursor } = elements;
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

    window.clearTimeout(hoverTimeout);
    hoverTimeout = window.setTimeout(
      () => hover(target),
      isHidden ? 0 : CURSOR_HOVER_DELAY,
    );
  }

  const director: DataTableLaunchDirector = {
    focus(target, { scale = DEFAULT_ZOOM, offsetX = 0, offsetY = 0 } = {}) {
      const { camera } = elements;
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
      elements.pointer?.animate(
        [{ scale: "1" }, { scale: "0.9" }, { scale: "1" }],
        { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
      elements.ripple?.animate(
        [
          { opacity: 0.6, scale: "0.2" },
          { opacity: 0, scale: "1.4" },
        ],
        { duration: 360, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    },
    reset() {
      window.clearTimeout(hoverTimeout);
      setCamera(1, 0, 0);
      const { cursor } = elements;
      if (cursor) cursor.style.opacity = "0";
    },
  };

  return { director, attach };
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function subscribeToNothing() {
  return () => {};
}

function DataTableLaunchCursorOverlay({
  attach,
}: {
  attach: DataTableLaunchDirectorAttach;
}) {
  const { overlay, overlayCamera, cursor, ripple, pointer } = attach;

  return (
    <div
      ref={overlay}
      className="pointer-events-none fixed top-0 left-0 z-51 overflow-hidden"
    >
      <div ref={overlayCamera} className="launch-camera absolute inset-0">
        <div
          ref={cursor}
          className="launch-cursor absolute top-0 left-0 opacity-0"
        >
          <span
            ref={ripple}
            className="absolute -top-3.5 -left-3.5 size-7 rounded-full border border-white/80 opacity-0"
          />
          <svg
            ref={pointer}
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
