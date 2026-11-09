# Plan: one path through the hook, instance ids, and a definition that owns what the server reads

Handoff plan for an implementing agent. Repo: `/Users/sadman/code/tablecn`. Branch: `sadman/data-table-query-keys` (already checked out). The working tree holds the uncommitted work from `.claude/plans/data-table-definition.md`. Build on top of it. Do not revert, stash, commit, or branch.

## Rules for this task

- Read `AGENTS.md` and `REVIEW.md` first and follow the skill loading step in `AGENTS.md` before editing.
- Do not commit, push, or edit the PR. Leave all changes uncommitted and report back.
- No explanatory code comments. No Linear issue ids in code, commit text, or PR text.
- Edit only the `radix` copy of a registry file, then run `pnpm sync:bases`. Never run `check:bases --update` to hide drift.
- Breaking the public API is allowed and expected. No compatibility shims, deprecated aliases, or re-exports of removed names.
- If a decision below turns out to be unworkable, stop on that item, finish everything that does not depend on it, and say exactly what blocked you. Do not substitute a different design silently.

## Why

An audit of the definition work found three structural problems. Each was confirmed with a probe test.

1. **Two descriptions of a table, both live.** `useDataTable` branches on `definition ? … : …` four times (`src/registry/bases/radix/hooks/use-data-table.ts:134-163`). The two paths follow different rules. The column config is applied twice: in `createDataTableColumnHelper` (`src/lib/data-table-column-helper.ts:36`) and again in the hook (`getDefinedColumn`, `:535`).
2. **`id` lives in the definition.** With a definition, the hook's `id` is `never` (`:93`), so one definition cannot be mounted twice on a page.
3. **The definition owns only sorting and page size.** The rest of what the server reads can still drift from the client:
   - `initialState.joinOperator: "or"` gives "or" on the client and "and" from `definition.parse("")`.
   - `initialState.columnFilters` in server mode shows a filter in the UI, writes nothing to the URL, and the server sees none.
   - `enableGlobalFilter` is a hook option, so `parse` returns `globalFilter` even when the client has it off.
   - Page size options are hardcoded in `DataTablePagination` and cannot be set through `<DataTable>`.
   - `parse` returns `page=-3`, `perPage=1000000` and `hours=gt.abc` unchanged.

## Decisions already made

The owner can flip these before handoff. Implement them as written otherwise.

- **Instance id is an option, not a `withId()` method.** `useDataTable({ definition, id })` and `definition.parse(search, { id })`. The definition's own `id` stays as the default namespace.
- **Default filters are not supported with a definition.** An absent URL key cannot mean both "use the default" and "the user cleared it", so `initialState.columnFilters` and `initialState.globalFilter` become type errors when a definition is passed. Link to a filtered URL instead.
- **The definition stays optional.** A table without one keeps working. The hook derives the same fields from `columns` and then runs the same code as a table with a definition.

## Target API

### Definition

```ts
export const tasksTable = defineDataTable({
  id: "tasks", // optional default namespace
  columns: { ... },
  defaultSorting: [{ id: "createdAt", desc: true }],
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 30, 40, 50],
  defaultJoinOperator: "and",
  enableGlobalFilter: false,
});
```

New options and their defaults: `pageSizeOptions: [10, 20, 30, 40, 50]`, `defaultJoinOperator: "and"`, `enableGlobalFilter: true`. All three appear on `DataTableDefinition` with defaults applied.

`parse(search, options?: { id?: string })`:

- `id` overrides the definition's own id for that call. An empty string throws, the same as today.
- `page` below 1 reads as 1.
- `perPage` that is neither in `pageSizeOptions` nor equal to `defaultPageSize` reads as `defaultPageSize`.
- `globalFilter` is `""` when `enableGlobalFilter` is false.
- A `number` or `range` filter whose value does not parse as a number is dropped. A `date` or `date-range` filter whose value `parseFilterDate` rejects is dropped, except for `isRelativeToToday`. Valueless operators are unaffected.

`parsers` and `urlKeys` stay public and describe the definition's own id.

### Hook

```ts
useDataTable({ definition: tasksTable, id: "open", columns, data, pageCount });
useDataTable({ definition: tasksTable, id: "closed", columns, data, pageCount });
```

- `id?: string` is accepted with or without a definition. Resolved id is `id ?? definition.id`.
- With a definition, these are type errors: `enableGlobalFilter`, `pageSizeOptions`, and the `initialState` slices `sorting`, `pagination`, `joinOperator`, `columnFilters`, `globalFilter`. At runtime the hook overwrites those slices from the definition, the way it does for `sorting` and `pagination` today.
- Without a definition, the hook accepts `enableGlobalFilter` and a new `pageSizeOptions` option, and `initialState` is unrestricted, as today.
- `onPaginationChange`, `onSortingChange`, `onColumnFiltersChange`, `onGlobalFilterChange`, `onJoinOperatorChange` are out of scope here (see "Not in this plan").

### Column helper

`createDataTableColumnHelper` keeps its types and stops merging the config at runtime. `accessor(id, column)` returns `{ ...column, id, accessorKey: id }`. The hook is the only place the config is applied.

## Implementation steps

Work in this order. Run the narrow test file after each step.

### 1. `src/lib/data-table-definition.ts` and `src/lib/data-table-parsers.ts`

- Add the three options to `DataTableDefinitionOptions`, `DataTableDefinition` and `defineDataTable`.
- Move `DEFAULT_PAGE_SIZE_OPTIONS` to `src/lib/data-table-utils.ts` next to the other constants, so the pagination component can import it without importing the definition module.
- `getDataTableStateParsers` takes `pageSizeOptions` and builds the `page` and `perPage` parsers with the rules above. Both server and client get the rules from this one function.
- Put the number and date value check in the item parser inside `getColumnFilterParser`, where inactive filters already return `null`. Do not change `parseColumnFilter` or `serializeColumnFilter`.
- `parse` takes the optional `{ id }`. Keep the loaders for the definition's own id created once. For an override id, build the loader for that call. Do not add a cache keyed by id.
- `parse` returns `globalFilter: ""` when the definition has `enableGlobalFilter: false`. The `search` key stays reserved either way.

### 2. Hook: one path

In `src/registry/bases/radix/hooks/use-data-table.ts`:

- Define one internal type for what the hook needs from a definition: `id`, `columns`, `defaultSorting`, `defaultPageSize`, `pageSizeOptions`, `defaultJoinOperator`, `enableGlobalFilter`. It replaces the current `Pick<DataTableDefinition, …>`.
- When no definition is passed, build that object from the props: column configs from `columns`, defaults from `initialState.sorting`, `initialState.pagination.pageSize`, `initialState.joinOperator`, and the `enableGlobalFilter` and `pageSizeOptions` options. One new function, for example `getColumnConfigs(columns)`, replaces `getFilterableVariants` and `getSortableIds`. It must produce configs for which `getFilterableColumns` and `getSortableColumns` return exactly what those two functions return today:
  - sortable: the column has an accessor and `enableSorting !== false`.
  - filterable: `enableColumnFilter` is truthy, with `variant: meta?.variant ?? "text"` and `filter` copied from the meta.
- After that point the hook has no `definition ? … : …` branches for state. `columnIndex`, the parsers and the URL keys all come from the one object through `getSortableColumns`, `getFilterableColumns`, `getDataTableStateParsers`, `getDataTableFilterParsers` and `getDataTableUrlKeys(filterableIds, resolvedId)`.
- Keep `getDefinedColumn`, and apply it only when a definition was passed. A derived object came from the columns, so there is nothing to apply. Applying it anyway would add `meta.variant: "text"` to columns that have none and make the toolbar render a text input for them.
- A definition object that is recreated on every render with the same `id` and the same `columns` reference must not rebuild parsers or URL keys. Key the memos on the fields, not on the object.
- Change the prop types as described under "Hook". Lift `id?: never`.
- Pass `pageSizeOptions` to `useTable` (see step 4).
- Run `pnpm sync:bases`, then `pnpm check:bases`.

### 3. Column helper

- `src/lib/data-table-column-helper.ts`: remove the `getColumnConfigOptions` merge from `accessor`. If the return type needs a cast once the merged `variant` is gone, stop and report instead of adding one.
- `getColumnConfigOptions` stays in the definition module for `getDefinedColumn`.

### 4. Page size options reach the pagination

- `src/lib/data-table-features.ts`: add `pageSizeOptions?: readonly number[]` to the custom feature's table options interface, next to `onJoinOperatorChange`.
- `data-table-pagination.tsx`: remove the `pageSizeOptions` prop. Read `table.options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS`. Leave the existing fallback that adds the current page size to the list when it is missing.
- Run `pnpm sync:bases`.

This step and the `perPage` rule in step 1 can be dropped together without affecting the rest. If you drop them, say so.

### 5. Demo call sites

- `src/app/lib/validations.ts`: add `enableGlobalFilter: false` to `tasksTable`.
- `src/app/components/tasks-table.tsx`: remove `enableGlobalFilter: false` from the hook call.
- The three demos in `src/app/bases/components/` pass `definition: tasksTable` and show a global search input. Give them their own definition with global filtering on, or drop the definition there and rely on the derived path. Pick whichever needs less code and report it.
- `src/app/data-table-launch/components/data-table-launch-demo.tsx` uses server mode with no definition and `initialState.sorting` and `pagination`. It must keep working unchanged.
- `src/app/page.tsx` and `src/app/lib/queries.ts` need no change unless types force one.

### 6. Tests

`src/lib/test/data-table-definition.test.ts`:

- Defaults for the three new options.
- `parse(search, { id: "a" })` and `parse(search, { id: "b" })` on one definition read one query string independently. An empty override id throws.
- `page=-3` reads as 1. `perPage=1000000` reads as the default. A `perPage` equal to a `defaultPageSize` that is not in `pageSizeOptions` is kept.
- `hours=gt.abc` on a number column and an unparseable date are dropped. `rel.` filters and `is.empty` survive.
- `enableGlobalFilter: false` returns `globalFilter: ""` for `?search=x`.

`src/hooks/test/use-data-table.test.tsx`:

- One definition mounted twice with `id: "a"` and `id: "b"` keeps the two tables apart, using `renderDataTables`.
- With a definition, `initialState.joinOperator`, `initialState.columnFilters` and `initialState.globalFilter` are `@ts-expect-error` and ignored at runtime. `table.resetJoinOperator()` returns to the definition's default.
- `defaultJoinOperator: "or"` on a definition gives "or" in table state and from `definition.parse("")`.
- `enableGlobalFilter: false` on a definition ignores `?search=` in the hook.
- A table with no definition behaves exactly as before: every existing no-definition test passes without edits. If one needs an edit, report why.
- Rerendering with a new definition object that has the same fields does not write to the URL or reset state.

`src/lib/test/data-table-column-helper.test.ts`: update the "applies its config" case. The helper no longer sets `enableColumnFilter`, `enableSorting` or `meta.variant`; the hook test "applies the definition to the columns" already covers the result.

`src/hooks/test/data-table-pagination.test.tsx`: the size list comes from the table option.

Keep the helper names `renderDataTable`, `renderDataTables` and `renderHookWithUrl`.

## Verify

Show the tail of real output for each.

```
pnpm vitest run src/lib/test/data-table-definition.test.ts src/lib/test/data-table-parsers.test.ts src/lib/test/data-table-column-helper.test.ts src/hooks/test/use-data-table.test.tsx src/hooks/test/data-table-pagination.test.tsx
pnpm check
pnpm test
pnpm build:registry
```

`pnpm test:e2e` needs the database from `pnpm db:start`. Run it if the database starts. Default URL keys are unchanged, so `e2e/data-table.spec.ts` should pass untouched. If you cannot run it, say so.

## Not in this plan

These came out of the same audit and are still open. Do not fix them here.

- Column meta accepts `filter: "range"` on a column the definition calls plain `number` (`ColumnDisplayMeta` in `src/lib/data-table-definition.ts:49`). The filter then never reaches the URL.
- The hook accepts `onSortingChange`, `onPaginationChange`, `onColumnFiltersChange`, `onGlobalFilterChange` and `onJoinOperatorChange` and silently overrides them. `state` cannot be passed at all.
- The column helper's `accessor` cannot build `accessorFn` columns.
- Sort menu, filter menu and command filter menu bind their shortcuts on `window`, so two tables on a page both respond.
- Group columns: the hook reads only top-level `columns`, so a filterable or sortable leaf inside a group is neither URL-synced nor covered by the definition.
- No check that definition columns and column defs agree. A definition column with no column def still reads its URL filter into table state.
- Select and multi-select values are not validated by `parse`. The demo keeps `sanitizeEnumFilters`.
- Two tables with the same resolved id share state with no warning.
- The hook's own debounce and drafts versus nuqs `limitUrlUpdates`, the `debounceMs` option passed to nuqs, and the `shallow: true` default in server mode.
- Naming drift: `perPage` versus `pageSize`, `sort` and `search` versus `sorting` and `globalFilter`.
- Syncing the diceui copy and its docs.

## Hand back

Reply with: what changed per step, the choices you made where the plan left one open (bases demos, step 4 kept or dropped), the check output tails, anything that deviated from this plan and why, and what the checks do not cover.
