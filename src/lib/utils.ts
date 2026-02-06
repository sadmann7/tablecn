import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // Sort arrays of objects by 'id' if present for order-independent comparison
    const sortByKey = (arr: unknown[]) =>
      [...arr].sort((x, y) => {
        if (
          typeof x === "object" &&
          x !== null &&
          "id" in x &&
          typeof y === "object" &&
          y !== null &&
          "id" in y
        ) {
          return String((x as Record<string, unknown>).id).localeCompare(
            String((y as Record<string, unknown>).id),
          );
        }
        return 0;
      });
    const sortedA = sortByKey(a);
    const sortedB = sortByKey(b);
    return sortedA.every((item, i) => deepEqual(item, sortedB[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

export function getAbsoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    return normalizedPath;
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? 3000}`;

  return `${baseUrl}${normalizedPath}`;
}
