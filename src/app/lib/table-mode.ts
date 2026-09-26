export const tableModes = ["server", "client"] as const;

export type TableMode = (typeof tableModes)[number];
