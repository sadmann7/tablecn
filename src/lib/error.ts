import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";

export function getErrorMessage(error: unknown) {
  if (isRedirectError(error)) throw error;

  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("\n");
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong, please try again later.";
}
