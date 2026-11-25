import { describe, expect, it } from "vitest";

import { getQueryStatus } from "../query-status";

const rows = { rows: [], rowCount: 0 };

describe("getQueryStatus", () => {
  it("is loading while the first fetch has no data", () => {
    expect(
      getQueryStatus({
        data: undefined,
        isPending: true,
        isFetching: true,
        isError: false,
      }),
    ).toBe("loading");
  });

  it("is loading while pending without a fetch", () => {
    expect(
      getQueryStatus({
        data: undefined,
        isPending: true,
        isFetching: false,
        isError: false,
      }),
    ).toBe("loading");
  });

  it("is refreshing while fetching with previous data", () => {
    expect(
      getQueryStatus({
        data: rows,
        isPending: false,
        isFetching: true,
        isError: false,
      }),
    ).toBe("refreshing");
  });

  it("is an error once the fetch has failed", () => {
    expect(
      getQueryStatus({
        data: undefined,
        isPending: false,
        isFetching: false,
        isError: true,
      }),
    ).toBe("error");
    expect(
      getQueryStatus({
        data: rows,
        isPending: false,
        isFetching: false,
        isError: true,
      }),
    ).toBe("error");
  });

  it("leaves the error while a retry is fetching", () => {
    expect(
      getQueryStatus({
        data: undefined,
        isPending: false,
        isFetching: true,
        isError: true,
      }),
    ).toBe("loading");
  });

  it("is idle with data and no fetch", () => {
    expect(
      getQueryStatus({
        data: rows,
        isPending: false,
        isFetching: false,
        isError: false,
      }),
    ).toBe("idle");
  });
});
