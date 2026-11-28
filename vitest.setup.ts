import "@testing-library/dom";
import { afterEach } from "vitest";

import { destroyAnnouncer } from "@/lib/data-grid-announcer";

afterEach(() => {
  destroyAnnouncer();
});
