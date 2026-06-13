# [tablecn](https://tablecn.com)

This is a shadcn table component with server-side sorting, filtering, and pagination. It is bootstrapped with `create-t3-app`.

[![tablecn](./public/images/screenshot.png)](https://tablecn.com)

[![Vercel OSS Program](https://vercel.com/oss/program-badge.svg)](https://vercel.com/oss)

## Documentation

See the [documentation](https://diceui.com/docs/components/data-table) to get started.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com)
- **Table package:** [TanStack/react-table](https://tanstack.com/table/latest)
- **Database:** [PlanetScale](https://planetscale.com)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team)
- **Validation:** [Zod](https://zod.dev)

## Features

- [x] Server-side pagination, sorting, and filtering
- [x] Customizable columns
- [x] Auto generated filters from column definitions
- [x] Dynamic `Data-Table-Toolbar` with search, filters, and actions
- [x] `Notion/Airtable` like advanced filtering
- [x] `Linear` like filter menu for command palette filtering
- [x] Action bar on row selection

## Running Locally

### Quick Setup (with Docker)

1. **Clone the repository**

   ```bash
   git clone https://github.com/sadmann7/tablecn
   cd tablecn
   ```

2. **Copy the environment variables**

   ```bash
   cp .env.example .env
   ```

3. **Run the setup**

   ```bash
   pnpm ollie
   ```

   This will install dependencies, start the Docker PostgreSQL instance, set up the database schema, and seed it with sample data.

### Manual Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/sadmann7/tablecn
   cd tablecn
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your database credentials.

4. **Choose your database approach:**

   **Option A: Use Docker PostgreSQL**

   ```bash
   pnpm db:start   # start the PostgreSQL container
   pnpm db:setup   # push schema and seed data
   pnpm dev        # start the Next.js dev server
   ```

   **Option B: Use existing PostgreSQL database**

   ```bash
   # Update .env with your DATABASE_URL, then:
   pnpm db:setup
   pnpm dev
   ```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm dev:multiplayer` | Start Next.js + PartyKit dev servers together |
| `pnpm dev:docker` | Start Docker PostgreSQL then Next.js |
| `pnpm build` | Production build |
| `pnpm check` | Run Biome lint + TypeScript type-check |
| `pnpm lint` | Lint with Biome |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm typecheck` | TypeScript type-check only |
| `pnpm test` | Run tests with Vitest |
| `pnpm db:start` | Start the Docker PostgreSQL container |
| `pnpm db:stop` | Stop the Docker PostgreSQL container |
| `pnpm db:setup` | Push schema + seed the database |
| `pnpm db:reset` | Wipe and re-seed the database |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm build:registry` | Build the shadcn component registry |
| `pnpm ollie` | Full first-time setup (install + db:start + db:setup) |

## How do I deploy this?

Follow the deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

The multiplayer demo uses [PartyKit](https://partykit.io) as a separate deployment. Run `pnpm dlx partykit deploy` from the project root and set `NEXT_PUBLIC_PARTYKIT_HOST` in your Vercel environment variables.

## Credits

- [shadcn/ui](https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(app)/examples/tasks) - For the initial implementation of the data table.
