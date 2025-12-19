import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAsRef } from "@/hooks/use-as-ref";

describe("useAsRef", () => {
  it("should return a ref with the initial value", () => {
    const { result } = renderHook(() => useAsRef({ count: 0 }));

    expect(result.current.current).toEqual({ count: 0 });
  });

  it("should update ref.current when value changes", () => {
    const { result, rerender } = renderHook(({ value }) => useAsRef(value), {
      initialProps: { value: { count: 0 } },
    });

    expect(result.current.current).toEqual({ count: 0 });

    rerender({ value: { count: 1 } });

    expect(result.current.current).toEqual({ count: 1 });
  });

  it("should maintain the same ref object across renders", () => {
    const { result, rerender } = renderHook(({ value }) => useAsRef(value), {
      initialProps: { value: "initial" },
    });

    const initialRef = result.current;

    rerender({ value: "updated" });

    expect(result.current).toBe(initialRef);
    expect(result.current.current).toBe("updated");
  });

  it("should work with primitive values", () => {
    const { result, rerender } = renderHook(({ value }) => useAsRef(value), {
      initialProps: { value: 42 },
    });

    expect(result.current.current).toBe(42);

    rerender({ value: 100 });

    expect(result.current.current).toBe(100);
  });

  it("should work with functions", () => {
    const fn1 = () => "first";
    const fn2 = () => "second";

    const { result, rerender } = renderHook(({ value }) => useAsRef(value), {
      initialProps: { value: fn1 },
    });

    expect(result.current.current).toBe(fn1);
    expect(result.current.current()).toBe("first");

    rerender({ value: fn2 });

    expect(result.current.current).toBe(fn2);
    expect(result.current.current()).toBe("second");
  });

  it("should work with null and undefined", () => {
    const { result, rerender } = renderHook(({ value }) => useAsRef(value), {
      initialProps: { value: null as string | null | undefined },
    });

    expect(result.current.current).toBeNull();

    rerender({ value: undefined });

    expect(result.current.current).toBeUndefined();

    rerender({ value: "defined" });

    expect(result.current.current).toBe("defined");
  });

  it("should handle complex objects with nested properties", () => {
    const { result, rerender } = renderHook(({ value }) => useAsRef(value), {
      initialProps: {
        value: {
          user: { name: "John", age: 30 },
          settings: { theme: "dark" },
        },
      },
    });

    expect(result.current.current).toEqual({
      user: { name: "John", age: 30 },
      settings: { theme: "dark" },
    });

    rerender({
      value: {
        user: { name: "Jane", age: 25 },
        settings: { theme: "light" },
      },
    });

    expect(result.current.current).toEqual({
      user: { name: "Jane", age: 25 },
      settings: { theme: "light" },
    });
  });
});
