import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  skaterMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    pdf: { maxFileSize: "8MB", maxFileCount: 5 },
    audio: { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "8MB", maxFileCount: 5 },
  })
    .middleware(async () => {
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
