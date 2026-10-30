import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";

export function getErrorMessage(err: unknown) {
  // Redirects are `Error` instances, so rethrow them before reading messages
  if (isRedirectError(err)) throw err;

  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join("\n");
  }

  if (err instanceof Error) return err.message;

  return "Something went wrong, please try again later.";
}
