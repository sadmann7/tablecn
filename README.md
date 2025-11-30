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

### Quick Setup (with docker)

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
   # Start PostgreSQL container
   pnpm db:start
   
   # Set up database schema and seed data
   pnpm db:setup
   
   # Start development server
   pnpm dev
   ```

   **Option B: Use existing PostgreSQL database**

   ```bash
   # Update .env with your database URL
   # Then set up database schema and seed data
   pnpm db:setup
   
   # Start development server
   pnpm dev
   ```

## How do I deploy this?

Follow the deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Credits

- [shadcn/ui](https://github.com/shadcn-ui/ui/tree/main/apps/www/app/(app)/examples/tasks) - For the initial implementation of the data table.
