import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const utapi = new UTApi();

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit();
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const { fileKeys } = (await request.json()) as { fileKeys: string[] };

    if (!fileKeys || fileKeys.length === 0) {
      return NextResponse.json(
        { error: "No file keys provided" },
        { status: 400 },
      );
    }

    // Delete files from UploadThing
    const result = await utapi.deleteFiles(fileKeys);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error deleting files:", error);
    return NextResponse.json(
      { error: "Failed to delete files" },
      { status: 500 },
    );
  }
}
