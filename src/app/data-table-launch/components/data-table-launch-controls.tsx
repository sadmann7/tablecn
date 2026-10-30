"use client";

import type * as React from "react";

import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/registry/bases/radix/ui/button";

import { SCENES } from "../lib/script";

interface DataTableLaunchControlsProps {
  scale: number;
  sceneIndex: number;
  isPaused: boolean;
  progressRef: React.RefObject<HTMLDivElement | null>;
  onPauseToggle: () => void;
  onRestart: () => void;
  onSeek: (sceneIndex: number) => void;
  onChromeToggle: () => void;
}

export function DataTableLaunchControls({
  scale,
  sceneIndex,
  isPaused,
  progressRef,
  onPauseToggle,
  onRestart,
  onSeek,
  onChromeToggle,
}: DataTableLaunchControlsProps) {
  return (
    <div
      className="absolute inset-x-0 bottom-4 flex justify-center"
      style={{ zoom: String(1 / scale) }}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-2 py-1.5 text-white/70 backdrop-blur-md">
        <Button
          aria-label={isPaused ? "Play" : "Pause"}
          aria-keyshortcuts="Space K"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={onPauseToggle}
        >
          {isPaused ? <Play /> : <Pause />}
        </Button>
        <Button
          aria-label="Restart"
          aria-keyshortcuts="R"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={onRestart}
        >
          <RotateCcw />
        </Button>
        <div className="flex items-center gap-1">
          {SCENES.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              aria-label={`Go to ${scene.id}`}
              aria-keyshortcuts={String(index + 1)}
              aria-current={index === sceneIndex ? "step" : undefined}
              data-state={index === sceneIndex ? "active" : undefined}
              className="rounded-full px-2 py-1 font-mono text-xs text-white/60 capitalize hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none data-[state=active]:bg-white/10 data-[state=active]:text-white"
              onClick={() => onSeek(index)}
            >
              {scene.id}
            </button>
          ))}
        </div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/15">
          <div
            ref={progressRef}
            className="h-full w-full origin-left bg-white/80"
            style={{ scale: "var(--launch-progress, 0) 1" }}
          />
        </div>
        <button
          type="button"
          className="rounded-full px-3 font-mono text-xs text-white/60 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          aria-keyshortcuts="H"
          onClick={onChromeToggle}
        >
          Space · ← → · R · H to hide
        </button>
      </div>
    </div>
  );
}
