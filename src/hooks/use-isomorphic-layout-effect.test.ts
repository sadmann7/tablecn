import { renderHook } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

describe("useIsomorphicLayoutEffect", () => {
  it("should use useLayoutEffect in browser environment", () => {
    // In jsdom (browser-like environment), it should use useLayoutEffect
    expect(typeof window).not.toBe("undefined");
    expect(useIsomorphicLayoutEffect).toBe(React.useLayoutEffect);
  });

  it("should run the effect", () => {
    const effect = vi.fn();

    renderHook(() => {
      useIsomorphicLayoutEffect(effect);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("should run the effect with dependencies", () => {
    const effect = vi.fn();

    const { rerender } = renderHook(
      ({ dep }) => {
        useIsomorphicLayoutEffect(effect, [dep]);
      },
      { initialProps: { dep: 1 } },
    );

    expect(effect).toHaveBeenCalledTimes(1);

    // Rerender with same dep - should not run effect again
    rerender({ dep: 1 });
    expect(effect).toHaveBeenCalledTimes(1);

    // Rerender with different dep - should run effect again
    rerender({ dep: 2 });
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("should run cleanup function", () => {
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);

    const { unmount } = renderHook(() => {
      useIsomorphicLayoutEffect(effect);
    });

    expect(effect).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();

    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("should run cleanup before re-running effect", () => {
    const callOrder: string[] = [];
    const cleanup = vi.fn(() => {
      callOrder.push("cleanup");
    });
    const effect = vi.fn(() => {
      callOrder.push("effect");
      return cleanup;
    });

    const { rerender } = renderHook(
      ({ dep }) => {
        useIsomorphicLayoutEffect(effect, [dep]);
      },
      { initialProps: { dep: 1 } },
    );

    expect(callOrder).toEqual(["effect"]);

    rerender({ dep: 2 });

    expect(callOrder).toEqual(["effect", "cleanup", "effect"]);
  });

  it("should work with empty dependency array (mount only)", () => {
    const effect = vi.fn();

    const { rerender } = renderHook(
      ({ value }) => {
        useIsomorphicLayoutEffect(effect, []);
        return value;
      },
      { initialProps: { value: 1 } },
    );

    expect(effect).toHaveBeenCalledTimes(1);

    rerender({ value: 2 });
    rerender({ value: 3 });

    // Should still only be called once due to empty deps
    expect(effect).toHaveBeenCalledTimes(1);
  });
});
