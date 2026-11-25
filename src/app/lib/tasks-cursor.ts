import * as z from "zod";

const tasksCursorSchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().min(1),
});

export type TasksCursor = z.infer<typeof tasksCursorSchema>;

export function encodeTasksCursor(cursor: TasksCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeTasksCursor(value: string): TasksCursor | null {
  try {
    const parsed = tasksCursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString()),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
