# Plan: one shared definition per data table

Handoff plan for an implementing agent. Repo: `/Users/sadman/code/tablecn`. Branch: `sadman/data-table-query-keys` (already checked out, PR #1277 open). Build on top of this branch. Do not create a branch.

## Rules for this task

- Read `AGENTS.md` and `REVIEW.md` first. `AGENTS.md` asks you to run `pnpm dlx @tanstack/intent@latest list` and load a matching skill before editing, and to read `node_modules/next/dist/docs/` before touching Next.js code.
- Do not commit, push, or edit the PR. Leave all changes uncommitted and report back. The owner reviews before every commit.
- No explanatory code comments. No Linear issue ids in code, commit text, or PR text.
- Edit only the `radix` copy of a registry file, then run `pnpm sync:bases`. Never run `check:bases --update` to hide drift.
- Breaking the public API is allowed and expected. Do not keep compatibility shims, deprecated aliases, or re-exports of the removed names.
- If a design decision below turns out to be unworkable, stop on that item, finish everything that does not depend on it, and say exactly what blocked you. Do not substitute a different design silently.

## Why

Three backlog items are one problem: server parsers ignore renamed URL keys, two tables on a page share URL keys, and (later) tables need a non-URL state mode. The cause is that a table is described in three places that must agree by hand:

1. `tasksColumnConfigs` plus `getDataTableSearchParams` and `getDataTableQuery` on the server (`src/app/lib/validations.ts`, `src/app/page.tsx`).
2. Column `meta.variant` plus `getColumnOptions(...)` on the client (`src/app/components/tasks-table.tsx`, `src/app/bases/lib/data-table-columns.tsx`).
3. Hook options: `queryKeys`, `queryKeyPrefix`, `initialState.sorting`, `initialState.pagination.pageSize` (`src/registry/bases/radix/hooks/use-data-table.ts`).

The current branch patched this by adding `queryKeyPrefix` and returning `{ parsers, urlKeys }` from `getDataTableSearchParams`. That is a fourth value to keep in sync. This plan replaces all of it with one definition object shared by server and client.

## Target API

### Shared definition (server-safe module, no `"use client"`)

```ts
// src/app/lib/validations.ts
export const tasksTable = defineDataTable({
  id: "tasks", // optional. Omit it in the tasks demo so its URLs stay `?page=2&status=todo`.
  columns: {
    code: { isSortable: false },
    title: { variant: "text" },
    status: { variant: "multi-select" },
    priority: { variant: "multi-select" },
    estimatedHours: { variant: "number", filter: "range" },
    createdAt: { variant: "date", filter: "range" },
  },
  defaultSorting: [{ id: "createdAt", desc: true }],
  defaultPerPage: 10,
});
```

`defineDataTable` returns a frozen plain object:

| Member | Purpose |
| -- | -- |
| `id`, `columns`, `defaultSorting`, `defaultPerPage` | The inputs, with defaults applied (`defaultSorting: []`, `defaultPerPage: 10`). |
| `parse(search)` | Reads search params and returns the `DataTableQuery` directly. Accepts what nuqs `createLoader` accepts synchronously: a record, `URLSearchParams`, or a string. |
| `parsers`, `urlKeys` | The nuqs parser map and key map, for apps that build a serializer or compose their own cache. |
| `column(id)` | Returns `{ enableColumnFilter, enableSorting }` for a column, replacing `getColumnOptions`. See "Column helper" for the meta question. |

Types:

- `DataTableDefinition<TColumns>` for the returned object.
- `InferDataTableQuery<typeof tasksTable>` replaces `DataTableColumnConfigsQuery<typeof tasksColumnConfigs>`.

### URL keys

- No `id`: keys are `page`, `perPage`, `sort`, `joinOperator`, `search`, and one key per filterable column id. Same as today.
- With `id`: every key is `${id}.${key}`, for example `?tasks.page=2&tasks.sort=title.asc&tasks.status=todo`. The separator is a dot and is not configurable.
- Per-key renames are removed. `queryKeys` and `queryKeyPrefix` go away with no replacement. Namespacing by `id` covers the collision cases that renames were used for.

### Clash rules

- A filterable column whose id is `page`, `perPage`, `sort`, `joinOperator` or `search` is an error. Make it a type error in `defineDataTable` when the columns are literal, and keep a runtime throw in `defineDataTable` as the authority.
- Non-filterable columns may use those ids, since they produce no URL key.
- `id` must be non-empty when given. Throw on an empty string.

### Server

```ts
// src/app/page.tsx
const searchParams = await props.searchParams;
const { dataMode, dir, filterMode } = searchParamsCache.parse(searchParams); // app's own params only
const query = tasksTable.parse(searchParams);
getTasks(query);
```

`searchParamsCache` in `validations.ts` keeps only `filterMode`, `dataMode` and `dir`. The table parsers are no longer spread into it.

### Client

```ts
const { table } = useDataTable({ definition: tasksTable, columns, data, pageCount });
```

Hook option changes:

- Add `definition?: DataTableDefinition`. When set, URL keys come from `definition.urlKeys`, and the default sorting and page size come from the definition.
- Add `id?: string` for client-only tables that have no definition. It namespaces the keys the same way. `definition` and `id` are mutually exclusive in the types.
- Remove `queryKeys` and `queryKeyPrefix`.
- Precedence when a definition is passed: `definition.defaultSorting` and `definition.defaultPerPage` win over `initialState.sorting` and `initialState.pagination.pageSize`. The server uses the definition, so a client override would recreate the drift. Cover this with a test.
- Without a definition and without `id`, behavior is exactly what `main` does today.

The hook keeps deriving sortable and filterable column sets from `columns`. Do not add a runtime comparison between `columns` and `definition.columns`.

## Implementation steps

Work in this order. Run the narrow test file after each step.

### 1. New module `src/lib/data-table-definition.ts`

- Move the URL key logic out of `src/lib/data-table-parsers.ts`: the current `getUrlKeys`, `QUERY_KEY_NAMES`, `assertColumnId`, and `DataTableQueryKeyOptions`. Rewrite them for the new rules (id namespace with a dot, no renames). Export one internal helper the hook can use for the no-definition path, for example `getDataTableUrlKeys(filterableIds, id?)`.
- Implement `defineDataTable` there. Build `parsers` from the existing primitives that stay in `data-table-parsers.ts` (`getSortingStateParser`, `getColumnFilterParser`, `getFilterableColumns`, `getSortableColumns`, `getColumnFilters`).
- `parse` uses `createLoader(parsers, { urlKeys })` from `nuqs/server`, created once per definition, then maps the result to `DataTableQuery` the way `getDataTableQuery` does now.
- Delete from `data-table-parsers.ts`: `getDataTableSearchParams`, `getDataTableQuery`, `getColumnOptions`, `getUrlKeys` and its helpers. Keep the file free of anything the new module re-implements.
- Delete from `src/lib/data-table-types.ts`: `DataTableQueryKeys` and `DataTableColumnConfigsQuery`. Add the two new types where they fit best.
- Register the new file in `registry.json` everywhere `src/lib/data-table-parsers.ts` is listed (around line 101), with the matching target path. Run `pnpm build:registry`.

### 2. Hook, `src/registry/bases/radix/hooks/use-data-table.ts`

- Replace the `urlKeys` memo and the five `queryKeys?.x` locals with keys from `definition.urlKeys`, or from the internal helper when only `id` or nothing is passed. The memo should depend on `definition`, `id` and the column index only.
- Keep the filter-order logic that maps URL keys back to column ids (`idByFilterKey`). It is needed whenever keys are namespaced.
- Structural requirement for the later non-URL mode: put every nuqs call (`useQueryState`, `useQueryStates`, and the `useSyncExternalStore` read of `location.search`) into one internal hook in the same file, for example `useUrlTableState(...)`, that returns plain values and setters. The rest of `useDataTable` must not import from `nuqs`. Do not build the local mode now.
- Run `pnpm sync:bases`, then `pnpm check:bases`.

### 3. Column helper

- `definition.column(id)` returns `{ enableColumnFilter, enableSorting }`.
- Try to also return a typed `meta` holding the variant fields from the config (`variant`, `filter`, and any other keys of `ColumnVariantOptions`), so call sites write `meta: { ...tasksTable.column("status").meta, label: "Status", options }` instead of copying `variant` by hand. Look at `ColumnVariantMeta` and `DataTableColumnMeta` in `src/lib/data-table-types.ts` first.
- If the merged meta cannot be typed without casts at the call site, drop `meta` from the helper and keep the current pattern of reading `tasksTable.columns.status.variant`. Report which path you took.

### 4. Demo call sites

- `src/app/lib/validations.ts`: replace `tasksColumnConfigs`, `tasksDefaultSorting` and the spread parsers with `tasksTable`. No `id`.
- `src/app/page.tsx`: use `tasksTable.parse`.
- `src/app/lib/queries.ts`: `getTasks(input: InferDataTableQuery<typeof tasksTable>)`. Check `filter-columns.ts` and `utils.ts` in the same folder for the old type.
- `src/app/components/tasks-table.tsx`: pass `definition: tasksTable`, remove the `queryKeys` prop and `initialState.sorting`, switch columns to `tasksTable.column(...)`.
- `src/app/bases/lib/data-table-columns.tsx` and the three demos in `src/app/bases/components/`: same column helper change. They are client-mode tables. Pass `definition: tasksTable` and drop their inline `initialState.sorting`.
- `src/app/data-table-launch/`: check the hook call in `components/data-table-launch-demo.tsx` still type-checks. The code strings in `lib/script.ts` do not mention removed options and need no change.
- Grep the whole repo for every removed name before finishing: `getDataTableSearchParams`, `getDataTableQuery`, `getColumnOptions`, `queryKeys`, `queryKeyPrefix`, `DataTableQueryKeys`, `DataTableColumnConfigsQuery`, `tasksColumnConfigs`, `tasksDefaultSorting`, `getUrlKeys`.

### 5. Tests

- New `src/lib/test/data-table-definition.test.ts`:
  - `parse` returns defaults, reads filters in URL order, and matches what the `getDataTableQuery` tests assert today. Move those cases over from `data-table-parsers.test.ts`.
  - With `id: "tasks"`, `parse("?tasks.page=2&tasks.status=todo&page=9")` reads only the namespaced keys.
  - Two definitions with different ids parse one query string independently.
  - A filterable column named `search` throws, and a non-filterable column named `page` does not. Add a `// @ts-expect-error` case for the type error.
  - Empty `id` throws.
- `src/hooks/test/use-data-table.test.tsx`:
  - Replace the `queryKeys` and `queryKeyPrefix` tests with `id` and `definition` equivalents. Keep the two-tables-on-one-page test, using `renderDataTables`.
  - A definition's `defaultSorting` and `defaultPerPage` are used, and win over `initialState`.
  - A table with neither option still reads and writes the plain keys.
- Keep helper names `renderDataTable`, `renderDataTables` and `renderHookWithUrl`.

## Verify

Show the tail of real output for each.

```
pnpm vitest run src/lib/test/data-table-definition.test.ts src/lib/test/data-table-parsers.test.ts src/hooks/test/use-data-table.test.tsx
pnpm check
pnpm test
pnpm build:registry
```

`pnpm test:e2e` needs the database from `pnpm db:start`. Run it if the database starts. The default URL keys are unchanged, so `e2e/data-table.spec.ts` should pass untouched. If you cannot run it, say so.

Two lint warnings in `src/lib/data-table-utils.ts` and one in `src/registry/bases/aria/ui/avatar.tsx` exist on `main`. Leave them. Fix any new warning, including the repo's `top-down-order` rule.

## Out of scope

- The non-URL state mode itself. Step 2 only makes room for it.
- A demo page with two tables. The hook test covers the behavior.
- Syncing the diceui copy and its docs. That is done by hand later.
- `perPage` clamping, cursor pagination, and other backlog items.

## Hand back

Reply with: what changed per step, which column helper path you took, the check output tails, anything that deviated from this plan and why, and what the checks do not cover.
