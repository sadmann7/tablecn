# Review

tablecn ships copy-paste components through a shadcn registry. A bug here lands in other people's apps, so failure means a component that breaks, drifts, or slows down after someone copies it.

## Checks

- `pnpm check` runs lint, format, typecheck, and `check:bases`.
- `pnpm test` for unit tests.
- `pnpm test:e2e` when the data table's interaction changes. It needs the database from `pnpm db:start`.
- `pnpm build:registry` when a file under `src/registry` is added, renamed, or changes its imports.

## What to look for

- **Bases drift.** Every file under `src/registry/bases/radix` has copies in `base` and `aria`. A fix in one copy and not the others is a bug, even when `check:bases` passes after `--update`. A change to `registry/base-differences.json` needs a reason.
- **Public API.** Props, hook options, and column meta are used by people who copied an older version. Renames and removed options need the docs and the demos updated in the same change.
- **Data grid interaction.** Focus, selection, keyboard navigation, cell editing, undo/redo, and pinned columns. Check the keyboard path, not only the pointer path.
- **Render cost.** The grid is virtualized. Look for new re-renders per cell, per scroll, or per keystroke, unstable references passed to rows, and extra URL writes.
- **Server and data.** Filters and sorts build SQL through Drizzle. Look for user input reaching raw SQL and for filters that silently drop rows.
- **Reset to the config.** The data table's defaults come from `createDataTableConfig` and seed the table's initial state. Reset buttons call `reset*()` to go back to that state, never `reset*(true)`, which ignores the config (for example a `defaultJoinOperator` of `"or"`).
- **Multiplayer.** `party/types.ts` is shared by the client and the room server. Message changes need both sides updated.
- **Fixes.** A bug fix names the cause and fixes it, not the symptom.
- **Comments.** Comments that restate the code, narrate steps, or explain the fix, and JSDoc on components, parts, or internal helpers. Lint only checks the form; the rules are under Comments in `AGENTS.md`.

## Skip

- Formatting, import order, and comment punctuation. `oxfmt` and the rules in `lint/` enforce them.
- `pnpm-lock.yaml`, `drizzle/` migrations, `public/r`, `recordings/`, `test-results/`.

## Format

- Start with a count: `N important, N nit, N pre-existing`. Say plainly when nothing needs fixing.
- Every finding gives `file:line` and the input or state that breaks.
- At most three nits.
