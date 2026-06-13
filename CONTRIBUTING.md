# Contributing Guide

Thank you for investing your time in contributing to tablecn.

If you have any questions, feel free to reach out to [@sadmann17](https://x.com/sadmann17).

## Project Structure

This repository contains two table implementations, each with its own hooks, components, and demo pages:

- **Data Table**: a server-driven table for displaying db records with sorting, filtering, pagination, and read-only rows.
- **Data Grid**: an interactive spreadsheet-like grid with inline editing, virtualized rows, keyboard navigation, live data updates, and multiplayer collaboration.

```text
src/
├── app/
│   ├── page.tsx                  # Data Table demo (home page)
│   ├── data-grid/                # Data Grid demo
│   ├── data-grid-live/           # Data Grid with live data sync (TanStack DB and TanStack Query)
│   ├── data-grid-multiplayer/    # Data Grid with multiplayer collaboration (PartyKit)
│   └── data-grid-render/         # Data Grid cell renderer showcase (internal)
│
├── components/
│   ├── data-table/               # Data Table UI components (toolbar, filters, pagination…)
│   ├── data-grid/                # Data Grid UI components (cells, menus, presence…)
│   ├── layouts/                  # Site header and mobile navigation
│   └── ui/                       # shadcn/ui primitives
│
├── hooks/
│   ├── use-data-table.ts         # Data Table logic (sorting, filtering, pagination)
│   ├── use-data-grid.ts          # Data Grid logic (editing, selection, virtualization…)
│   └── use-multiplayer-room.ts   # PartyKit WebSocket connection and collection sync
│
├── db/                           # Drizzle schema, migrations, and seed scripts
├── config/                       # Site config and navigation links
└── styles/                       # Global styles

party/                            # PartyKit server (runs separately via pnpm dev:multiplayer)
├── index.ts                      # WebSocket server for connections, presence, and mutations
├── types.ts                      # Shared message types (client ↔ server)
├── constants.ts                  # Shared constants (colors, adjectives, animals…)
└── seeds.ts                      # Initial seed data for the multiplayer room

### Data Table vs Data Grid

| | Data Table | Data Grid |
| --- | --- | --- |
| **Hook** | `use-data-table.ts` | `use-data-grid.ts` |
| **Data source** | PostgreSQL (server actions) | In-memory / TanStack DB |
| **Editing** | Read-only rows | Inline cell editing |
| **Virtualization** | Pagination | Infinite scrolling |
| **Real-time sync** | No | Yes (TanStack DB collection) |
| **Multiplayer** | No | Yes (via PartyKit) |

## Getting started

### Fork the repository

Fork the project by clicking the fork button in the top right corner of the [tablecn](https://github.com/sadmann7/tablecn) repository.

### Clone the project

```shell
git clone https://github.com/<your-username>/tablecn
```

### Navigate to the project

```shell
cd tablecn
```

### Create a new branch

```shell
git checkout -b add-kickflip
```

### Install dependencies

```shell
pnpm install
```

### Start the dev server

For the standard data table and data grid:

```shell
pnpm dev
```

For the multiplayer data-grid:

```shell
pnpm dev:multiplayer
```

### Commit your changes

When commiting your changes, use the following format:

```text
<type>(<scope>): <description>
```

**Types:**

- `feat` : a new feature
- `fix` : a bug fix
- `refactor` : code change that is neither a feature nor a bug fix
- `perf` : performance improvement
- `style` : formatting, missing semicolons, etc. (no logic change)
- `test` : adding or updating tests
- `docs` : documentation changes only
- `chore` : build process, dependency updates, tooling

**Scope:**
Scope your commit to the part of the codebase that is affected, for example `data-table`, `data-grid`, `multiplayer`, `ui`, or `deps`.

Examples:

```shell
git commit -m "fix(data-table): add advanced filtering"
git commit -m "feat(data-grid): add real-time collaboration"
```

### Create a pull request

When you're finished pushing your changes, open a pull request.

### Issues

#### Create a new issue

If you find an issue in the codebase that needs to be fixed, or you have an idea for a new feature, take a look at the [Issues](https://github.com/sadmann7/tablecn/issues).

If you can't find an open issue addressing the problem, [open a new one](https://github.com/sadmann7/tablecn/issues/new).

#### Solve an issue

Search for an [existing issue](https://github.com/sadmann7/tablecn/issues) that interests you. You can narrow down the search using `labels` and `projects`.

Then, fork the repository, create a branch, make your changes, and open a pull request.
