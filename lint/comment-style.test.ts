import { RuleTester } from "oxlint/plugins-dev";

import { commentStyle, noLowValueComments } from "./comment-style.ts";

const ruleTester = new RuleTester();

ruleTester.run("comment-style", commentStyle, {
  valid: [
    "// Radix closes the menu on scroll, so the open state is mirrored here.\nconst open = false;",
    "const GAP = 4; // In px, matching the toolbar gap.",
    "// Lines right under each other\n// read as one comment.\nconst a = 1;",
    "// Is this reachable?\nconst a = 1;",
    "// See https://github.com/mui/base-ui/issues/1234\nconst a = 1;",
    "// TODO: Remove once Base UI ships `modal`. https://github.com/mui/base-ui/issues/1234\nconst a = 1;",
    "// Fixed upstream in vercel/next.js#81234.\nconst a = 1;",
    "/** Whether the row can be selected. */\nconst a = 1;",
    "/**\n * Builds one cell per leaf column.\n * @param column The column to build from.\n */\nfunction f(column) {}",
    "// eslint-disable-next-line\nconst a = 1;",
    "// @ts-expect-error\nconst a = f();",
    "/* @__PURE__ */ f();",
    "/**\n * One.\n * Two.\n * Three.\n * Four.\n */\nconst a = 1;",
    "/**\n * Prints the registry.\n *\n *   pnpm print:registry   print every item\n */\nconst a = 1;",
    "/**\n * Builds the registry.\n * One.\n * Two.\n * Three.\n * Four.\n */\nconst a = 1;",
  ],
  invalid: [
    {
      code: "// Mirrors the open state\nconst open = false;",
      output: "// Mirrors the open state.\nconst open = false;",
      errors: ["End the comment with a full stop."],
    },
    {
      code: "const GAP = 4; // in px",
      output: "const GAP = 4; // in px.",
      errors: ["End the comment with a full stop."],
    },
    {
      code: "// Lines right under each other\n// read as one comment\nconst a = 1;",
      output:
        "// Lines right under each other\n// read as one comment.\nconst a = 1;",
      errors: ["End the comment with a full stop."],
    },
    {
      code: "/** Whether the row can be selected */\nconst a = 1;",
      output: "/** Whether the row can be selected. */\nconst a = 1;",
      errors: ["End the comment with a full stop."],
    },
    {
      code: "/**\n * Builds one cell per leaf column\n * @param column The column.\n */\nfunction f(column) {}",
      output:
        "/**\n * Builds one cell per leaf column.\n * @param column The column.\n */\nfunction f(column) {}",
      errors: ["End the comment with a full stop."],
    },
    {
      code: "// ---- Helpers ----\nconst a = 1;",
      errors: ["Drop the section divider; let the code's structure show it."],
    },
    {
      code: "// const a = 1;\nconst b = 2;",
      errors: ["Delete commented-out code; git keeps the history."],
    },
    {
      code: "// Arrange\nconst a = 1;",
      errors: ["Drop the test step label."],
    },
    {
      code: "// TODO: Clean this up.\nconst a = 1;",
      errors: ["Link the issue that tracks this, or drop the marker."],
    },
    {
      code: "// Added in #1184.\nconst a = 1;",
      errors: [
        "Drop the PR or issue number; git history records it. Keep the reason.",
      ],
    },
    {
      code: "/**\n * Builds the cells.\n * @param {string} id The row id.\n */\nfunction f(id: string) {}",
      filename: "file.ts",
      errors: ["Drop the JSDoc type; TypeScript already has it."],
    },
    {
      code: "/**\n * Builds the cells.\n * @returns\n */\nfunction f() {}",
      errors: ["Drop the JSDoc tag that has no description."],
    },
    {
      code: "// One.\n// Two.\n// Three.\n// Four.\n// Five.\nconst a = 1;",
      errors: [
        "Cut this to 4 lines or fewer: keep the constraint, drop the background.",
      ],
    },
    {
      code: "const a = 1;\n/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n */\nconst b = 2;",
      errors: [
        "Cut this to 4 lines or fewer: keep the constraint, drop the background.",
      ],
    },
    {
      code: "// Note: the order matters.\nconst a = 1;",
      errors: ["Drop the filler `Note` and say the reason directly."],
    },
    {
      code: "// Here the order matters to us.\nconst a = 1;",
      errors: ["Describe the code instead of `we`/`our`."],
    },
  ],
});

ruleTester.run("no-low-value-comments", noLowValueComments, {
  valid: [
    "// Sorted rows stay stable; the virtualizer keys on them.\nconst filteredRows = [];",
    "const filteredRows = []; // The filtered rows.",
    "/**\n * The filtered rows.\n * @default []\n */\nconst filteredRows = [];",
  ],
  invalid: [
    {
      code: "// Returns the filtered rows.\nfunction getFilteredRows() {}",
      errors: [
        "Drop the comment; it only repeats the name below it. Say why, or say nothing.",
      ],
    },
    {
      code: "/** The row count. */\nexport const rowCount = 0;",
      errors: [
        "Drop the comment; it only repeats the name below it. Say why, or say nothing.",
      ],
    },
  ],
});
