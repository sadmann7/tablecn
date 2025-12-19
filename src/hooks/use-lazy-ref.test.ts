import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLazyRef } from "./use-lazy-ref";

describe("useLazyRef", () => {
  it("should initialize the ref with the result of the function", () => {
    const { result } = renderHook(() => useLazyRef(() => ({ value: 42 })));

    expect(result.current.current).toEqual({ value: 42 });
  });

  it("should only call the initializer function once", () => {
    const initializer = vi.fn(() => ({ count: 0 }));

    const { result, rerender } = renderHook(() => useLazyRef(initializer));

    expect(initializer).toHaveBeenCalledTimes(1);
    expect(result.current.current).toEqual({ count: 0 });

    rerender();
    rerender();
    rerender();

    expect(initializer).toHaveBeenCalledTimes(1);
  });

  it("should maintain the same ref object across renders", () => {
    const { result, rerender } = renderHook(() =>
      useLazyRef(() => ({ id: "test" })),
    );

    const initialRef = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(initialRef);
  });

  it("should work with primitive values", () => {
    const { result } = renderHook(() => useLazyRef(() => 100));

    expect(result.current.current).toBe(100);
  });

  it("should work with arrays", () => {
    const { result } = renderHook(() => useLazyRef(() => [1, 2, 3]));

    expect(result.current.current).toEqual([1, 2, 3]);
  });

  it("should work with Map", () => {
    const { result } = renderHook(() =>
      useLazyRef(() => new Map([["key", "value"]])),
    );

    expect(result.current.current).toBeInstanceOf(Map);
    expect(result.current.current?.get("key")).toBe("value");
  });

  it("should work with Set", () => {
    const { result } = renderHook(() => useLazyRef(() => new Set([1, 2, 3])));

    expect(result.current.current).toBeInstanceOf(Set);
    expect(result.current.current?.has(2)).toBe(true);
  });

  it("should handle expensive computations lazily", () => {
    let computationCount = 0;

    const expensiveComputation = () => {
      computationCount++;
      return Array.from({ length: 1000 }, (_, i) => i * 2);
    };

    const { result, rerender } = renderHook(() =>
      useLazyRef(expensiveComputation),
    );

    expect(computationCount).toBe(1);
    expect(result.current.current?.length).toBe(1000);
    expect(result.current.current?.[0]).toBe(0);
    expect(result.current.current?.[999]).toBe(1998);

    rerender();
    rerender();

    expect(computationCount).toBe(1);
  });

  it("should work with class instances", () => {
    class Counter {
      count = 0;
      increment() {
        this.count++;
      }
    }

    const { result, rerender } = renderHook(() =>
      useLazyRef(() => new Counter()),
    );

    expect(result.current.current).toBeInstanceOf(Counter);
    expect(result.current.current?.count).toBe(0);

    result.current.current?.increment();

    expect(result.current.current?.count).toBe(1);

    rerender();

    // Same instance should be maintained
    expect(result.current.current?.count).toBe(1);
  });
});
