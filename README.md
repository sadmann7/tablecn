# [tablecn](https://tablecn.com)

Data table and data grid components built with shadcn/ui, featuring sorting, filtering, pagination, infinite scrolling, and real-time collaboration.

[![tablecn](./public/images/screenshot.png)](https://tablecn.com)

## Documentation

See the [documentation](https://diceui.com/docs/components/data-table) to get started.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com)
- **Table:** [TanStack Table](https://tanstack.com/table/latest)
- **Reactive store:** [TanStack DB](https://tanstack.com/db/latest)
- **Database:** [PostgreSQL](https://www.postgresql.org)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team)
- **Validation:** [Zod](https://zod.dev)
- **Multiplayer:** [PartyKit](https://partykit.io)

## Features

- [x] Server-side pagination, sorting, and filtering
- [x] Customizable columns
- [x] Auto generated filters from column definitions
- [x] `Notion/Airtable` like advanced filtering
- [x] `Linear` like filter menu for command palette filtering
- [x] Action bar on row selection
- [x] Infinite scrolling with virtualization
- [x] Real-time collaboration

## Running Locally

### Quick Setup (with Docker)

1. **Clone the repository**

   ```bash
   git clone https://github.com/sadmann7/tablecn
   cd tablecn
   ```

1. **Copy the environment variables**

   ```bash
   cp .env.example .env
   ```

1. **Run the setup**

   ```bash
   pnpm ollie
   ```

   This installs dependencies, starts the Docker PostgreSQL instance, pushes the schema, and seeds sample data.

### Manual Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/sadmann7/tablecn
   cd tablecn
   ```

1. **Install dependencies**

   ```bash
   pnpm install
   ```

1. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your database credentials.

1. **Start the database and dev server**

   ```bash
   pnpm db:start   # start the PostgreSQL container
   pnpm db:setup   # push schema and seed data
   pnpm dev        # start the Next.js dev server
   ```

### Multiplayer

To run the multiplayer demo locally:

```bash
pnpm dev:multiplayer
```

This starts both the Next.js and PartyKit dev servers concurrently.

## Deployment

Follow the deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify), and [Docker](https://create.t3.gg/en/deployment/docker).

The multiplayer demo uses [PartyKit](https://partykit.io) as a separate deployment:

```bash
pnpm deploy:multiplayer
```

Set `NEXT_PUBLIC_PARTYKIT_HOST` in your deployment environment variables after deploying.

## Credits

- [shadcn/ui](https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(app)/examples/tasks) - For the initial implementation of the data table.
