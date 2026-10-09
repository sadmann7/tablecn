import * as React from "react";

import { getIsEditableTarget } from "@/lib/data-table-utils";

import {
  getSceneIndex,
  LAUNCH_DURATION,
  LAUNCH_STEPS,
  type LaunchStep,
  SCENES,
} from "../lib/script";

const MAX_FRAME_MS = 1000;
const MAX_STEP_LAG_MS = 100;

interface LaunchClock {
  elapsed: number;
  stepIndex: number;
  cycle: number;
  isPaused: boolean;
  replayTo: number | null;
}

interface LaunchPlayback {
  sceneIndex: number;
  cycle: number;
  isPaused: boolean;
  isChromeHidden: boolean;
}

type LaunchPlaybackAction =
  | { type: "scene"; sceneIndex: number; cycle: number }
  | { type: "pause"; isPaused: boolean }
  | { type: "chrome" };

const INITIAL_PLAYBACK: LaunchPlayback = {
  sceneIndex: 0,
  cycle: 0,
  isPaused: false,
  isChromeHidden: false,
};

export function useLaunchTimeline(onStep: (step: LaunchStep) => void) {
  const [playback, dispatch] = React.useReducer(
    playbackReducer,
    INITIAL_PLAYBACK,
  );
  const clockRef = React.useRef<LaunchClock>({
    elapsed: 0,
    stepIndex: 0,
    cycle: 0,
    isPaused: false,
    replayTo: null,
  });
  const progressRef = React.useRef<HTMLDivElement>(null);
  const runStep = React.useEffectEvent(onStep);

  React.useEffect(() => {
    let frame = 0;
    let last = performance.now();

    function onFrame(now: number) {
      const clock = clockRef.current;
      const delta = Math.min(now - last, MAX_FRAME_MS);
      last = now;

      if (!clock.isPaused) {
        // One step per frame, so each step sees the table state and menus
        // the previous step rendered instead of the same stale snapshot.
        const step = LAUNCH_STEPS[clock.stepIndex];

        if (clock.replayTo !== null) {
          if (step && step.at <= clock.replayTo) {
            runStep(step);
            clock.stepIndex += 1;
          } else {
            clock.replayTo = null;
          }
        } else {
          clock.elapsed += delta;

          if (clock.elapsed >= LAUNCH_DURATION) {
            clock.elapsed = 0;
            clock.stepIndex = 0;
            clock.cycle += 1;
          } else if (step && step.at <= clock.elapsed) {
            // After a hitch, catching up would fire the next steps back to
            // back before their menus open, so the lost time is dropped.
            if (clock.elapsed - step.at > MAX_STEP_LAG_MS) {
              clock.elapsed = step.at;
            }
            runStep(step);
            clock.stepIndex += 1;
          }
        }

        dispatch({
          type: "scene",
          sceneIndex: getSceneIndex(clock.elapsed),
          cycle: clock.cycle,
        });
      }

      progressRef.current?.style.setProperty(
        "--launch-progress",
        String(clock.elapsed / LAUNCH_DURATION),
      );
      frame = requestAnimationFrame(onFrame);
    }

    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    clockRef.current.isPaused = true;
    dispatch({ type: "pause", isPaused: true });
  }, []);

  const onPauseToggle = React.useCallback(() => {
    const clock = clockRef.current;
    clock.isPaused = !clock.isPaused;
    dispatch({ type: "pause", isPaused: clock.isPaused });
  }, []);

  /**
   * Replays the loop from the start up to the scene, so every earlier step
   * runs and the table lands in the state that scene expects. The clock holds
   * at the scene start until the replay finishes.
   */
  const onSeek = React.useCallback((sceneIndex: number) => {
    const clock = clockRef.current;
    clock.elapsed = SCENES[sceneIndex]?.start ?? 0;
    clock.replayTo = clock.elapsed;
    clock.stepIndex = 0;
    clock.cycle += 1;
    dispatch({ type: "scene", sceneIndex, cycle: clock.cycle });
  }, []);

  const onRestart = React.useCallback(() => onSeek(0), [onSeek]);

  const onChromeToggle = React.useCallback(() => {
    dispatch({ type: "chrome" });
  }, []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.isTrusted || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (getIsEditableTarget(event.target)) return;

      if (event.key === " ") {
        event.preventDefault();
        onPauseToggle();
      } else if (event.key === "r") {
        onRestart();
      } else if (event.key === "h") {
        onChromeToggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPauseToggle, onRestart, onChromeToggle]);

  return {
    playback,
    progressRef,
    onPauseToggle,
    onRestart,
    onSeek,
    onChromeToggle,
  };
}

function playbackReducer(
  state: LaunchPlayback,
  action: LaunchPlaybackAction,
): LaunchPlayback {
  switch (action.type) {
    case "scene":
      if (
        state.sceneIndex === action.sceneIndex &&
        state.cycle === action.cycle
      ) {
        return state;
      }
      return { ...state, sceneIndex: action.sceneIndex, cycle: action.cycle };
    case "pause":
      return { ...state, isPaused: action.isPaused };
    case "chrome":
      return { ...state, isChromeHidden: !state.isChromeHidden };
  }
}
