import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // FileRoute for task attachments
  taskAttachment: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
    pdf: { maxFileSize: "8MB", maxFileCount: 5 },
    "application/msword": { maxFileSize: "8MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "8MB",
      maxFileCount: 5,
    },
    "application/vnd.ms-excel": { maxFileSize: "8MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "8MB",
      maxFileCount: 5,
    },
    "application/vnd.ms-powerpoint": { maxFileSize: "8MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "16MB", maxFileCount: 2 },
    audio: { maxFileSize: "8MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      // For demo purposes, we don't require authentication
      // In a real app, you would check the user session here
      // const user = await auth();
      // if (!user) throw new UploadThingError("Unauthorized");

      return {};
    })
    .onUploadComplete(async ({ file }) => {
      console.log("Upload complete:", file.name);

      // Return file data to the client
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
