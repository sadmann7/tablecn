# Data Grid Live

A feature-rich data grid component built with Next.js, shadcn/ui, and TanStack Table with real-time PostgreSQL persistence.

## Prerequisites

- Node.js 18+
- pnpm
- Docker (for local PostgreSQL)

## Quick Start

1. **Install dependencies and start development**

   ```bash
   pnpm ollie
   ```

   This command will:
   - Install all dependencies
   - Start Docker PostgreSQL instance
   - Set up database schema
   - Seed sample data
   - Start development server

2. **Open the app**

   Visit [http://localhost:3000/data-grid-live](http://localhost:3000/data-grid-live)

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The default configuration uses Docker PostgreSQL. Update `DATABASE_URL` if using a different database.

## Database Commands

```bash
pnpm db:start    # Start PostgreSQL container
pnpm db:stop     # Stop PostgreSQL container
pnpm db:setup    # Create schema and seed data
pnpm db:reset    # Reset database (deletes all data)
pnpm db:studio   # Open Drizzle Studio
```

## Development Commands

```bash
pnpm dev         # Start dev server
pnpm build       # Build for production
pnpm start       # Start production server
pnpm lint        # Run linter
pnpm typecheck   # Run TypeScript checks
```

## Tech Stack

- **Framework:** Next.js 16
- **UI:** shadcn/ui + Tailwind CSS
- **Table:** TanStack Table
- **Database:** PostgreSQL + Drizzle ORM
- **State:** TanStack Query + TanStack DB
