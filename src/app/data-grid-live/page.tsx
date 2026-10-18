import { env } from "@/env";

import { DataGridLiveLoader } from "./components/data-grid-live-loader";

export default function DataGridLivePage() {
  return (
    <>
      <h1 className="sr-only">Data Grid Live</h1>
      <DataGridLiveLoader isUploadConfigured={!!env.UPLOADTHING_TOKEN} />
    </>
  );
}
