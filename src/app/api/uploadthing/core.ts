import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { checkRateLimit } from "@/lib/rate-limit";

const f = createUploadthing();

export const ourFileRouter = {
  skaterMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    pdf: { maxFileSize: "8MB", maxFileCount: 5 },
    audio: { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "8MB", maxFileCount: 5 },
  })
    .middleware(async ({ req }) => {
      const limit = await checkRateLimit(req);
      if (!limit.success) {
        throw new UploadThingError(
          "Rate limit exceeded, please try again later.",
        );
      }

      return {};
    })
    .onUploadComplete(async ({ file }) => {
      return {
        id: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
        url: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
