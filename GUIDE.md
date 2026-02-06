# Guide: Implementing the DataGrid with Your Own Data

This guide walks through every piece of the data-grid system and exactly what you need to create or change to use it with your own data model. It uses "Products" as the example, but the same pattern applies to any entity.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [What You Do NOT Need to Touch](#what-you-do-not-need-to-touch)
3. [What You Need to Create / Modify](#what-you-need-to-create--modify)
4. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
5. [Step 1 — Database Schema](#step-1--database-schema)
6. [Step 2 — Validation Schemas (Zod)](#step-2--validation-schemas-zod)
7. [Step 3 — API Route (CRUD)](#step-3--api-route-crud)
8. [Step 4 — TanStack DB Collection (Optimistic Sync)](#step-4--tanstack-db-collection-optimistic-sync)
9. [Step 5 — Seed Script (Optional)](#step-5--seed-script-optional)
10. [Step 6 — Helper Utilities (Icons, Generators)](#step-6--helper-utilities-icons-generators)
11. [Step 7 — Column Definitions](#step-7--column-definitions)
12. [Step 8 — Filter Presets](#step-8--filter-presets)
13. [Step 9 — The Main DataGrid Component](#step-9--the-main-datagrid-component)
14. [Step 10 — Action Bar (Bulk Actions)](#step-10--action-bar-bulk-actions)
15. [Step 11 — Page Wrapper](#step-11--page-wrapper)
16. [Full File Checklist](#full-file-checklist)
17. [Key Concepts Reference](#key-concepts-reference)
18. [Troubleshooting & Gotchas](#troubleshooting--gotchas)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Browser                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  page.tsx (dynamic import, ssr: false)               │    │
│  │  └─ YourDataGrid component                          │    │
│  │     ├─ useLiveQuery() → reactive data               │    │
│  │     ├─ columns: ColumnDef<YourType>[]               │    │
│  │     ├─ filterPresets: FilterPreset<YourType>[]      │    │
│  │     ├─ useDataGrid({ data, columns, ... })          │    │
│  │     │   └─ returns { table, tableMeta, ...props }   │    │
│  │     ├─ useDataGridUndoRedo({ data, ... })           │    │
│  │     │                                               │    │
│  │     ├─ <DataGridFilterPresets />   ← toolbar        │    │
│  │     ├─ <DataGridFilterMenu />      ← toolbar        │    │
│  │     ├─ <DataGridSortMenu />        ← toolbar        │    │
│  │     ├─ <DataGridViewMenu />        ← toolbar        │    │
│  │     ├─ <DataGridRowHeightMenu />   ← toolbar        │    │
│  │     ├─ <DataGridKeyboardShortcuts /> ← toolbar      │    │
│  │     ├─ <DataGrid {...props} />     ← the grid       │    │
│  │     └─ <YourActionBar />           ← bulk actions   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TanStack DB Collection (optimistic cache)          │    │
│  │  └─ insert / update / delete → mutate local         │    │
│  │     then sync to API ↓                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                           │
│                                                             │
│  src/app/api/your-model/route.ts                            │
│  ├─ GET    → db.select().from(yourTable)                    │
│  ├─ POST   → db.insert(yourTable).values(...)               │
│  ├─ PATCH  → db.update(yourTable).set(...).where(...)       │
│  └─ DELETE → db.delete(yourTable).where(...)                │
│                          │                                   │
│                          ▼                                   │
│  Drizzle ORM → PostgreSQL (Docker)                          │
│  └─ src/db/schema.ts (your table definition)                │
└─────────────────────────────────────────────────────────────┘
```

---

## What You Do NOT Need to Touch

These files are fully generic over `TData` and work with any data model out of the box:

### Core UI Components (`src/components/data-grid/`)

| File | What it does |
|------|-------------|
| `data-grid.tsx` | Main grid renderer (header, virtualized body, "Add row" footer) |
| `data-grid-cell.tsx` | Cell rendering |
| `data-grid-cell-variants.tsx` | Per-type cell editors: `short-text`, `long-text`, `number`, `select`, `multi-select`, `checkbox`, `date`, `url`, `file` |
| `data-grid-cell-wrapper.tsx` | Cell wrapper with focus/selection/editing state |
| `data-grid-column-header.tsx` | Column header with sort/resize |
| `data-grid-context-menu.tsx` | Right-click context menu (copy, paste, delete, insert row) |
| `data-grid-filter-menu.tsx` | Column filter popover with operators |
| `data-grid-filter-presets.tsx` | Preset filter buttons (generic, no changes needed) |
| `data-grid-keyboard-shortcuts.tsx` | Keyboard shortcuts info dialog |
| `data-grid-paste-dialog.tsx` | Paste expansion confirmation dialog |
| `data-grid-row-height-menu.tsx` | Row height selector (short/medium/tall/extra-tall) |
| `data-grid-row.tsx` | Virtualized row renderer |
| `data-grid-search.tsx` | Cmd+F search bar |
| `data-grid-select-column.tsx` | Row selection checkbox column |
| `data-grid-skeleton.tsx` | Loading skeleton |
| `data-grid-sort-menu.tsx` | Sort control popover |
| `data-grid-view-menu.tsx` | Column visibility toggle menu |

### Hooks (`src/hooks/`)

| File | What it does |
|------|-------------|
| `use-data-grid.ts` | **The main hook** (~3,250 lines). Creates the TanStack Table instance, manages selection, focus, editing, clipboard, search, virtualizer. Returns `{ table, tableMeta, ...spreadProps }` |
| `use-data-grid-undo-redo.ts` | Undo/redo history tracking. Tracks cell updates, row adds, row deletes. Supports Cmd+Z / Cmd+Shift+Z |

### Lib Utilities (`src/lib/`)

| File | What it does |
|------|-------------|
| `data-grid.ts` | Grid helpers: `flexRender`, column pinning styles, cell keys, row height px, date formatting, etc. |
| `data-grid-filters.ts` | Filter operators (text, number, date, select, boolean) and the generic `getFilterFn<TData>()` |
| `export.ts` | `exportTableToCSV()` — CSV export from any TanStack Table |
| `id.ts` | `generateId()` using nanoid |
| `utils.ts` | `cn()` (tailwind merge) and `getAbsoluteUrl()` |

### Types (`src/types/`)

| File | What it does |
|------|-------------|
| `data-grid.ts` | All type definitions: `CellOpts`, `CellUpdate`, `FilterValue`, `SelectionState`, `SearchState`, `NavigationDirection`, filter operator types, `ColumnMeta` / `TableMeta` augmentations |
| `index.ts` | General types (`SearchParams`, etc.) |

### Infrastructure (no changes needed)

| File | What it does |
|------|-------------|
| `src/db/index.ts` | Drizzle DB connection (reads `DATABASE_URL` env var) |
| `src/db/utils.ts` | `pgTable` creator with `tablecn_` prefix, `takeFirstOrNull`, `takeFirstOrThrow`, `isEmpty` |
| `src/db/migrate.ts` | Migration runner |
| `docker-compose.yml` | PostgreSQL 17.4 container |
| `drizzle.config.ts` | Drizzle Kit config (points to `src/db/schema.ts`) |

---

## What You Need to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/db/schema.ts` | **Modify** | Add your Drizzle table definition |
| 2 | `src/app/(your-route)/lib/validation.ts` | **Create** | Zod schemas (select, insert, update, delete) + TypeScript type |
| 3 | `src/app/api/your-model/route.ts` | **Create** | CRUD API route with bulk support |
| 4 | `src/app/(your-route)/lib/collections.ts` | **Create** | TanStack DB collection with optimistic sync |
| 5 | `src/app/lib/seeds.ts` | **Modify** | Add seed function for your table _(optional)_ |
| 6 | `src/db/seed.ts` | **Modify** | Register your seed function _(optional)_ |
| 7 | `src/app/lib/utils.ts` | **Modify** | Add icon maps and random data generator _(optional)_ |
| 8 | `src/app/(your-route)/components/your-data-grid.tsx` | **Create** | **Main file** — columns, presets, callbacks, rendering |
| 9 | `src/app/(your-route)/components/your-action-bar.tsx` | **Create** | Bulk action bar for selected cells _(optional)_ |
| 10 | `src/app/(your-route)/page.tsx` | **Create** | Dynamic-import page wrapper |

**Summary: 4 files minimum, up to 10 for the full experience.**

---

## Prerequisites & Environment Setup

### Required dependencies (already in package.json)

```
@tanstack/react-table     — Table state management
@tanstack/react-virtual   — Row virtualization
@tanstack/react-db        — Optimistic data layer
@tanstack/query-db-collection — Collection adapter
@tanstack/react-query     — Query client (used internally by collection)
drizzle-orm               — Database ORM
zod                       — Schema validation
sonner                    — Toast notifications
date-fns                  — Date formatting
nanoid                    — ID generation
```

### Environment variables

Your `.env` file needs:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DATABASE_PORT=5432
DATABASE_PASSWORD=password
DATABASE_USER=user
DATABASE_NAME=dbname
```

### Start the database

```bash
pnpm db:start        # docker compose up -d
```

---

## Step 1 — Database Schema

**File:** `src/db/schema.ts`

Add your table using the project's `pgTable` (which auto-prefixes table names with `tablecn_`):

```typescript
import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "@/db/utils";
import { generateId } from "@/lib/id";

export const products = pgTable("products", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  order: integer("order").notNull().default(0),       // ← for row ordering
  name: varchar("name", { length: 128 }),
  category: varchar("category", {
    length: 30,
    enum: ["electronics", "clothing", "food", "toys"],
  })
    .notNull()
    .default("electronics"),
  price: integer("price").notNull().default(0),
  inStock: boolean("in_stock").notNull().default(true),
  tags: jsonb("tags").$type<string[]>(),               // ← for multi-select
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
```

> **Important:** The `pgTable` import comes from `@/db/utils`, NOT from `drizzle-orm/pg-core`. It applies the `tablecn_` prefix automatically.

Then push the schema:

```bash
pnpm db:push       # Quick push (dev)
# OR
pnpm db:generate   # Generate migration SQL
pnpm db:migrate    # Run migrations
```

---

## Step 2 — Validation Schemas (Zod)

**File:** `src/app/(your-route)/lib/validation.ts`

You need **four** schemas, not just one. The API route uses these for request validation:

```typescript
import { z } from "zod";
import { products } from "@/db/schema";

// Full row schema (what you SELECT from the DB)
export const productSchema = z.object({
  id: z.string(),
  order: z.number(),
  name: z.string().nullable(),
  category: z.enum(products.category.enumValues),
  price: z.number(),
  inStock: z.boolean(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

// Single insert schema (all fields optional except what's required)
export const insertProductSchema = z.object({
  id: z.string().optional(),
  order: z.number().optional(),
  name: z.string().nullable().optional(),
  category: z.enum(products.category.enumValues).optional(),
  price: z.number().optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

// Bulk insert wrapper
export const insertProductsSchema = z.object({
  products: z.array(insertProductSchema).min(1),
});

// Update schema (partial — only the fields being changed)
export const updateProductSchema = z.object({
  name: z.string().nullable().optional(),
  order: z.number().optional(),
  category: z.enum(products.category.enumValues).optional(),
  price: z.number().optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

// Bulk update wrapper
export const updateProductsSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        changes: updateProductSchema,
      }),
    )
    .min(1),
});

// Bulk delete
export const deleteProductsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

// The main type you'll use everywhere
export type ProductSchema = z.infer<typeof productSchema>;
```

---

## Step 3 — API Route (CRUD)

**File:** `src/app/api/products/route.ts`

The API supports **bulk operations** — this is critical for performance when the grid updates multiple rows:

```typescript
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  deleteProductsSchema,
  insertProductSchema,
  insertProductsSchema,
  updateProductsSchema,
} from "@/app/(your-route)/lib/validation";
import { db } from "@/db";
import { type Product, products } from "@/db/schema";

export async function GET() {
  try {
    const allProducts = await db.select().from(products);
    return NextResponse.json(allProducts);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

// Supports single and bulk insert
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    // Try bulk insert first
    const bulkResult = insertProductsSchema.safeParse(body);
    if (bulkResult.success) {
      const newProducts = await db
        .insert(products)
        .values(bulkResult.data.products)
        .returning();
      return NextResponse.json({
        inserted: newProducts.length,
        products: newProducts,
      });
    }

    // Try single insert
    const singleResult = insertProductSchema.safeParse(body);
    if (!singleResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: singleResult.error.flatten() },
        { status: 400 },
      );
    }

    const newProduct = await db
      .insert(products)
      .values(singleResult.data)
      .returning()
      .then((res) => res[0]);

    return NextResponse.json(newProduct);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}

// Bulk update: { updates: [{ id, changes: { price?, name?, ... } }, ...] }
export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = updateProductsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { updates } = result.data;
    const firstUpdate = updates.at(0);
    if (!firstUpdate) {
      return NextResponse.json({ error: "updates array is empty" }, { status: 400 });
    }

    // Single update — fast path
    if (updates.length === 1) {
      const [updated] = await db
        .update(products)
        .set(firstUpdate.changes)
        .where(eq(products.id, firstUpdate.id))
        .returning();
      return NextResponse.json({ updated: updated ? 1 : 0 });
    }

    // Check if all updates have the same changes (e.g., bulk status update)
    const firstChanges = JSON.stringify(firstUpdate.changes);
    const allSameChanges = updates.every(
      (u) => JSON.stringify(u.changes) === firstChanges,
    );

    if (allSameChanges) {
      // Single query with IN clause
      const ids = updates.map((u) => u.id);
      const updated = await db
        .update(products)
        .set(firstUpdate.changes)
        .where(inArray(products.id, ids))
        .returning();
      return NextResponse.json({ updated: updated.length });
    }

    // Different changes per row — use transaction
    const results = await db.transaction(async (tx) => {
      const updated: Product[] = [];
      for (const { id, changes } of updates) {
        const [updateResult] = await tx
          .update(products)
          .set(changes)
          .where(eq(products.id, id))
          .returning();
        if (updateResult) updated.push(updateResult);
      }
      return updated;
    });

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to update products" },
      { status: 500 },
    );
  }
}

// Bulk delete: { ids: string[] }
export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = deleteProductsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const deletedProducts = await db
      .delete(products)
      .where(inArray(products.id, result.data.ids))
      .returning();

    return NextResponse.json({ deleted: deletedProducts.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to delete products" },
      { status: 500 },
    );
  }
}
```

---

## Step 4 — TanStack DB Collection (Optimistic Sync)

**File:** `src/app/(your-route)/lib/collections.ts`

This is how the demo achieves instant UI updates. The collection acts as a local cache that syncs to the API in the background:

```typescript
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { getAbsoluteUrl } from "@/lib/utils";
import { type ProductSchema, productSchema } from "./validation";

const queryClient = new QueryClient();

export const productsCollection = createCollection(
  queryCollectionOptions({
    id: "products",
    queryKey: ["products"],
    queryClient,
    queryFn: async (): Promise<ProductSchema[]> => {
      const response = await fetch(getAbsoluteUrl("/api/products"));
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = productSchema.array().safeParse(await response.json()).data;
      if (!data) throw new Error("Failed to parse products");
      return data;
    },
    getKey: (item: ProductSchema) => item.id,
    schema: productSchema,
    onInsert: async ({ transaction }) => {
      const itemsToInsert = transaction.mutations
        .map((m) => m?.modified)
        .filter((modified): modified is ProductSchema => modified != null)
        .map(({ createdAt: _, updatedAt: __, ...data }) => data);

      if (itemsToInsert.length === 0) return;

      const response = await fetch(getAbsoluteUrl("/api/products"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: itemsToInsert }),
      });
      if (!response.ok) throw new Error("Failed to create products");
    },
    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations
        .filter(
          (m): m is typeof m & { key: string; changes: Partial<ProductSchema> } =>
            m?.key != null && m?.changes != null,
        )
        .map((m) => ({ id: m.key, changes: m.changes }));

      if (updates.length === 0) return;

      const response = await fetch(getAbsoluteUrl("/api/products"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error("Failed to update products");
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations
        .map((m) => m?.key)
        .filter((id): id is string => id != null);

      if (ids.length === 0) return;

      const response = await fetch(getAbsoluteUrl("/api/products"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("Failed to delete products");
    },
  }),
);
```

---

## Step 5 — Seed Script (Optional)

**File:** `src/app/lib/seeds.ts` — add your seed function:

```typescript
import { db } from "@/db/index";
import { type Product, products } from "@/db/schema";
import { generateRandomProduct } from "./utils"; // your helper (Step 6)

export async function seedProducts(input: { count: number }) {
  const count = input.count ?? 50;
  const allProducts: Product[] = [];

  for (let i = 0; i < count; i++) {
    allProducts.push(generateRandomProduct({ order: i }));
  }

  await db.delete(products);
  console.log("📦 Inserting products", allProducts.length);
  await db.insert(products).values(allProducts).onConflictDoNothing();
}
```

**File:** `src/db/seed.ts` — register it:

```typescript
const SEED_FUNCTIONS = {
  skaters: () => seedSkaters({ count: 100 }),
  products: () => seedProducts({ count: 50 }),  // ← add this
} as const;
```

Then run: `pnpm db:seed products`

---

## Step 6 — Helper Utilities (Icons, Generators)

**File:** `src/app/lib/utils.ts` — add icon maps and a random data generator:

```typescript
import { faker } from "@faker-js/faker";
import { Box, Shirt, UtensilsCrossed, ToyBrick, type LucideIcon } from "lucide-react";
import { type Product, products } from "@/db/schema";
import { generateId } from "@/lib/id";

// Icon maps for select columns (used in column options)
export function getCategoryIcon(category: Product["category"]): LucideIcon {
  const icons: Record<Product["category"], LucideIcon> = {
    electronics: Box,
    clothing: Shirt,
    food: UtensilsCrossed,
    toys: ToyBrick,
  };
  return icons[category];
}

// Random data generator for seed + "Add row"
export function generateRandomProduct(input?: Partial<Product>): Product {
  return {
    id: generateId(),
    order: 0,
    name: faker.commerce.productName(),
    category: faker.helpers.shuffle(products.category.enumValues)[0] ?? "electronics",
    price: faker.number.int({ min: 5, max: 500 }),
    inStock: faker.datatype.boolean({ probability: 0.7 }),
    tags: faker.helpers.arrayElements(
      ["sale", "new", "popular", "limited", "eco"],
      faker.number.int({ min: 0, max: 3 }),
    ),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
}
```

---

## Step 7 — Column Definitions

This is defined inside your main component file (Step 9), but it's the most important thing to get right. Every column needs:

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Must match a key from your data type |
| `accessorKey` | Yes | Same as `id` — the field name on your data object |
| `header` | Yes | Display name in the column header |
| `minSize` | Recommended | Minimum column width in pixels |
| `filterFn` | For filtering | Use `getFilterFn<YourType>()` — one instance for all columns |
| `meta.label` | For filter/sort menus | Human-readable label |
| `meta.cell.variant` | **Critical** | Determines the editor: `short-text`, `long-text`, `number`, `select`, `multi-select`, `checkbox`, `date`, `url`, `file` |
| `meta.cell.options` | For select/multi-select | Array of `{ label, value, icon? }` |
| `meta.cell.min/max/step` | For number | Numeric constraints |

### Available Cell Variants

| Variant | Used for | Renders as |
|---------|----------|-----------|
| `short-text` | Names, emails, short strings | Text input |
| `long-text` | Descriptions, notes | Textarea |
| `number` | Integers, decimals | Number input with min/max/step |
| `select` | Enum fields, status, category | Dropdown with options |
| `multi-select` | Tags, categories (array fields) | Multi-select with checkboxes |
| `checkbox` | Boolean fields | Checkbox |
| `date` | Timestamps, dates | Date picker (calendar) |
| `url` | Links | URL input |
| `file` | File uploads | File dropzone |

### Example Column Definition

```typescript
const filterFn = React.useMemo(() => getFilterFn<ProductSchema>(), []);

const columns = React.useMemo<ColumnDef<ProductSchema>[]>(
  () => [
    // Row selection column (optional — adds checkbox column)
    getDataGridSelectColumn<ProductSchema>({ enableRowMarkers: true }),
    {
      id: "name",
      accessorKey: "name",
      header: "Name",
      minSize: 200,
      filterFn,
      meta: {
        label: "Name",
        cell: { variant: "short-text" },
      },
    },
    {
      id: "category",
      accessorKey: "category",
      header: "Category",
      minSize: 160,
      filterFn,
      meta: {
        label: "Category",
        cell: {
          variant: "select",
          options: products.category.enumValues.map((cat) => ({
            label: cat.charAt(0).toUpperCase() + cat.slice(1),
            value: cat,
            icon: getCategoryIcon(cat),
          })),
        },
      },
    },
    {
      id: "price",
      accessorKey: "price",
      header: "Price",
      minSize: 120,
      filterFn,
      meta: {
        label: "Price",
        cell: { variant: "number", min: 0, max: 10000, step: 1 },
      },
    },
    {
      id: "inStock",
      accessorKey: "inStock",
      header: "In Stock",
      minSize: 90,
      filterFn,
      meta: {
        label: "In Stock",
        cell: { variant: "checkbox" },
      },
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: "Tags",
      minSize: 240,
      filterFn,
      meta: {
        label: "Tags",
        cell: {
          variant: "multi-select",
          options: [
            { label: "Sale", value: "sale" },
            { label: "New", value: "new" },
            { label: "Popular", value: "popular" },
            { label: "Limited", value: "limited" },
            { label: "Eco", value: "eco" },
          ],
        },
      },
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Created",
      minSize: 170,
      filterFn,
      meta: {
        label: "Created At",
        cell: { variant: "date" },
      },
    },
  ],
  [filterFn],
);
```

> **Important:** `getFilterFn<ProductSchema>()` returns a **single** universal filter function that handles all operator types (text contains, number greater than, date before, etc.). Create it once with `useMemo`, pass it to every column.

---

## Step 8 — Filter Presets

```typescript
import type { FilterPreset } from "@/components/data-grid/data-grid-filter-presets";

const filterPresets: FilterPreset<ProductSchema>[] = [
  {
    id: "all",
    label: "All Products",
    filters: [],         // empty = show everything
    columnVisibility: {},
    sorting: [],
  },
  {
    id: "in-stock",
    label: "In Stock",
    filters: [{ id: "inStock", value: true }],      // id must be keyof ProductSchema
    sorting: [{ id: "price", desc: false }],          // sort cheapest first
    className:                                         // Tailwind for inactive state
      "border-green-300 text-green-700 hover:bg-green-100 dark:border-green-800 dark:text-green-400",
    activeClassName:                                   // Tailwind for active state
      "bg-green-600 text-white ring-green-400 hover:bg-green-700",
  },
  {
    id: "electronics",
    label: "Electronics",
    filters: [{ id: "category", value: "electronics" }],
    columnVisibility: { tags: false, createdAt: false },  // hide these columns
    sorting: [{ id: "price", desc: true }],
  },
];
```

### How `activePreset` Works Internally

```
User clicks preset button
  → applyPreset() runs:
    → table.setColumnFilters(preset.filters ?? [])
    → table.setColumnVisibility(preset.columnVisibility ?? {})
    → table.setSorting(preset.sorting ?? [])
    → setActivePreset(preset.id)          ← highlights the button
    → onPresetChange?.(preset.id)         ← notifies your parent component

User clicks "Clear"
  → clearPreset() runs:
    → resets all filters, visibility, sorting to empty
    → setActivePreset(null)               ← un-highlights all buttons

User manually changes a filter via DataGridFilterMenu
  → The preset button stays highlighted (activePreset is click-tracked, not state-compared)
  → This is by design — the user can refine a preset
```

---

## Step 9 — The Main DataGrid Component

**File:** `src/app/(your-route)/components/products-data-grid.tsx`

This is the main file that wires everything together. Study the existing `data-grid-live-demo.tsx` — it's your template.

```typescript
"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import * as React from "react";
import { use } from "react";
import { toast } from "sonner";
import { getCategoryIcon, generateRandomProduct } from "@/app/lib/utils";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import {
  DataGridFilterPresets,
  type FilterPreset,
} from "@/components/data-grid/data-grid-filter-presets";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { products } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import {
  type UndoRedoCellUpdate,
  useDataGridUndoRedo,
} from "@/hooks/use-data-grid-undo-redo";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
import { productsCollection } from "../lib/collections";
import type { ProductSchema } from "../lib/validation";

// ─── Select Options (built from schema enum values) ─────────────────
const categoryOptions = products.category.enumValues.map((cat) => ({
  label: cat.charAt(0).toUpperCase() + cat.slice(1),
  value: cat,
  icon: getCategoryIcon(cat),
}));

const tagOptions = [
  { label: "Sale", value: "sale" },
  { label: "New", value: "new" },
  { label: "Popular", value: "popular" },
  { label: "Limited", value: "limited" },
  { label: "Eco", value: "eco" },
];

// ─── Filter Presets ─────────────────────────────────────────────────
const filterPresets: FilterPreset<ProductSchema>[] = [
  { id: "all", label: "All Products", filters: [], columnVisibility: {}, sorting: [] },
  {
    id: "in-stock",
    label: "In Stock",
    filters: [{ id: "inStock", value: true }],
    sorting: [{ id: "price", desc: false }],
  },
  // ... more presets
];

export function ProductsDataGrid() {
  // Preload the collection data
  use(productsCollection.preload());

  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // ─── Data Query (reactive, re-renders when collection changes) ──
  const { data = [] } = useLiveQuery(
    (q) => {
      let query = q.from({ product: productsCollection });
      for (const sort of sorting) {
        const field = sort.id as keyof ProductSchema;
        const direction = sort.desc ? "desc" : "asc";
        query = query.orderBy((t) => t.product[field], direction);
      }
      query = query.orderBy((t) => t.product.order, "asc");
      return query;
    },
    [sorting],
  );

  // ─── Filter Function ──────────────────────────────────────────────
  const filterFn = React.useMemo(() => getFilterFn<ProductSchema>(), []);

  // ─── Column Definitions ───────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<ProductSchema>[]>(
    () => [
      getDataGridSelectColumn<ProductSchema>({ enableRowMarkers: true }),
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        minSize: 200,
        filterFn,
        meta: { label: "Name", cell: { variant: "short-text" } },
      },
      {
        id: "category",
        accessorKey: "category",
        header: "Category",
        minSize: 160,
        filterFn,
        meta: { label: "Category", cell: { variant: "select", options: categoryOptions } },
      },
      {
        id: "price",
        accessorKey: "price",
        header: "Price",
        minSize: 120,
        filterFn,
        meta: { label: "Price", cell: { variant: "number", min: 0, max: 10000, step: 1 } },
      },
      {
        id: "inStock",
        accessorKey: "inStock",
        header: "In Stock",
        minSize: 90,
        filterFn,
        meta: { label: "In Stock", cell: { variant: "checkbox" } },
      },
      {
        id: "tags",
        accessorKey: "tags",
        header: "Tags",
        minSize: 240,
        filterFn,
        meta: { label: "Tags", cell: { variant: "multi-select", options: tagOptions } },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Created",
        minSize: 170,
        filterFn,
        meta: { label: "Created At", cell: { variant: "date" } },
      },
    ],
    [filterFn],
  );

  // ─── Undo/Redo ────────────────────────────────────────────────────
  const undoRedoOnDataChange = React.useCallback(
    (newData: ProductSchema[]) => {
      const currentIds = new Set(data.map((p) => p.id));
      const newIds = new Set(newData.map((p) => p.id));

      for (const item of data) {
        if (!newIds.has(item.id)) productsCollection.delete(item.id);
      }

      for (const item of newData) {
        if (!currentIds.has(item.id)) {
          productsCollection.insert(item);
        } else {
          const existing = data.find((p) => p.id === item.id);
          if (!existing) continue;
          const hasChanges = (Object.keys(item) as Array<keyof ProductSchema>).some(
            (key) => JSON.stringify(existing[key]) !== JSON.stringify(item[key]),
          );
          if (hasChanges) {
            productsCollection.update(item.id, (draft) => Object.assign(draft, item));
          }
        }
      }
    },
    [data],
  );

  const { trackCellsUpdate, trackRowsAdd, trackRowsDelete } =
    useDataGridUndoRedo({
      data,
      onDataChange: undoRedoOnDataChange,
      getRowId: (row) => row.id,
    });

  // ─── Data Change Handler (cell edits) ─────────────────────────────
  const onDataChange: NonNullable<UseDataGridProps<ProductSchema>["onDataChange"]> =
    React.useCallback(
      (newData) => {
        const cellUpdates: Array<UndoRedoCellUpdate> = [];

        for (const item of newData) {
          const existing = data.find((p) => p.id === item.id);
          if (!existing) {
            productsCollection.update(item.id, (draft) => Object.assign(draft, item));
            continue;
          }

          for (const key of Object.keys(item) as Array<keyof ProductSchema>) {
            if (JSON.stringify(existing[key]) !== JSON.stringify(item[key])) {
              cellUpdates.push({
                rowId: existing.id,
                columnId: key,
                previousValue: existing[key],
                newValue: item[key],
              });
              productsCollection.update(item.id, (draft) => {
                (draft as Record<string, unknown>)[key] = item[key];
              });
            }
          }
        }

        if (cellUpdates.length > 0) trackCellsUpdate(cellUpdates);
      },
      [data, trackCellsUpdate],
    );

  // ─── Row Add ──────────────────────────────────────────────────────
  const onRowAdd: NonNullable<UseDataGridProps<ProductSchema>["onRowAdd"]> =
    React.useCallback(() => {
      const maxOrder = data.reduce((max, p) => Math.max(max, p.order), 0);
      const newProduct = generateRandomProduct({ order: maxOrder + 1 });
      productsCollection.insert(newProduct);
      trackRowsAdd([newProduct]);
      return { rowIndex: data.length, columnId: "name" };
    }, [data, trackRowsAdd]);

  // ─── Bulk Row Add (paste expansion) ───────────────────────────────
  const onRowsAdd: NonNullable<UseDataGridProps<ProductSchema>["onRowsAdd"]> =
    React.useCallback(
      (count: number) => {
        const maxOrder = data.reduce((max, p) => Math.max(max, p.order), 0);
        const newRows: ProductSchema[] = [];
        for (let i = 0; i < count; i++) {
          const newProduct: ProductSchema = {
            id: generateId(),
            name: null,
            category: "electronics",
            price: 0,
            inStock: true,
            tags: null,
            order: maxOrder + i + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          newRows.push(newProduct);
          productsCollection.insert(newProduct);
        }
        trackRowsAdd(newRows);
      },
      [data, trackRowsAdd],
    );

  // ─── Row Delete ───────────────────────────────────────────────────
  const onRowsDelete: NonNullable<UseDataGridProps<ProductSchema>["onRowsDelete"]> =
    React.useCallback(
      (rowsToDelete) => {
        trackRowsDelete(rowsToDelete);
        productsCollection.delete(rowsToDelete.map((p) => p.id));
      },
      [trackRowsDelete],
    );

  // ─── useDataGrid Hook ─────────────────────────────────────────────
  const { table, tableMeta, ...dataGridProps } = useDataGrid({
    data,
    onDataChange,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    columns,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: { left: ["select"] },  // pin checkbox column
      sorting,
    },
    onSortingChange: setSorting,
    manualSorting: true,       // sorting is handled by the collection query
    enableSearch: true,        // Cmd+F search
    enablePaste: true,         // clipboard paste support
  });

  const height = Math.max(400, windowSize.height - 150);

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="container flex flex-col gap-4 py-4">
      {/* Toolbar */}
      <div role="toolbar" className="flex items-center gap-2">
        <DataGridFilterPresets table={table} presets={filterPresets} />
        <div className="ml-auto flex items-center gap-2">
          <DataGridKeyboardShortcuts enableSearch enableUndoRedo enablePaste enableRowAdd enableRowsDelete />
          <DataGridFilterMenu table={table} align="end" />
          <DataGridSortMenu table={table} align="end" />
          <DataGridRowHeightMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
      </div>

      {/* Grid */}
      <DataGrid {...dataGridProps} table={table} tableMeta={tableMeta} height={height} />

      {/* Action Bar (optional — see Step 10) */}
    </div>
  );
}
```

### `useDataGrid` Props Reference

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `TData[]` | Yes | Your reactive data array |
| `columns` | `ColumnDef<TData>[]` | Yes | Column definitions |
| `getRowId` | `(row: TData) => string` | Recommended | Stable row ID for virtualization |
| `onDataChange` | `(data: TData[]) => void` | For editing | Called when cells are edited |
| `onRowAdd` | `() => Partial<CellPosition> \| null` | For adding rows | Called when "Add row" is clicked |
| `onRowsAdd` | `(count: number) => void` | For paste expansion | Called when paste needs more rows |
| `onRowsDelete` | `(rows: TData[], indices: number[]) => void` | For deleting | Called on Delete key / context menu delete |
| `enableSearch` | `boolean` | No | Enable Cmd+F search |
| `enablePaste` | `boolean` | No | Enable clipboard paste |
| `readOnly` | `boolean` | No | Disable all editing |
| `manualSorting` | `boolean` | No | If true, sorting is handled externally (by your query) |
| `initialState` | `Partial<TableState>` | No | Initial sorting, pinning, visibility, etc. |
| `rowHeight` | `"short" \| "medium" \| "tall" \| "extra-tall"` | No | Default row height |
| `overscan` | `number` | No | Number of rows to render outside viewport |
| `autoFocus` | `boolean \| Partial<CellPosition>` | No | Focus cell on mount |

### `useDataGrid` Returns

| Return | Type | Description |
|--------|------|-------------|
| `table` | `Table<TData>` | TanStack Table instance |
| `tableMeta` | `TableMeta<TData>` | Extended metadata (focus, edit, selection state, callbacks) |
| `...dataGridProps` | Spread | Everything else — pass directly to `<DataGrid>` |

---

## Step 10 — Action Bar (Bulk Actions)

**File:** `src/app/(your-route)/components/products-action-bar.tsx`

The action bar appears when cells are selected, providing bulk operations:

```typescript
"use client";

import type { Table, TableMeta } from "@tanstack/react-table";
import { Trash2, X } from "lucide-react";
import * as React from "react";
import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/components/ui/action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CellSelectOption } from "@/types/data-grid";

interface ProductsActionBarProps<TData> {
  table: Table<TData>;
  tableMeta: TableMeta<TData>;
  selectedCellCount: number;
  categoryOptions?: CellSelectOption[];
  onCategoryUpdate?: (value: string) => void;
  onDelete?: () => void;
}

export function ProductsActionBar<TData>({
  table,
  tableMeta,
  selectedCellCount,
  categoryOptions,
  onCategoryUpdate,
  onDelete,
}: ProductsActionBarProps<TData>) {
  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        table.toggleAllRowsSelected(false);
        tableMeta.onSelectionClear?.();
      }
    },
    [table, tableMeta],
  );

  return (
    <ActionBar data-grid-popover open={selectedCellCount > 0} onOpenChange={onOpenChange}>
      <ActionBarSelection>
        <span className="font-medium">{selectedCellCount}</span>
        <span>{selectedCellCount === 1 ? "cell" : "cells"} selected</span>
        <ActionBarSeparator />
        <ActionBarClose><X /></ActionBarClose>
      </ActionBarSelection>
      <ActionBarSeparator />
      <ActionBarGroup>
        {/* Add your bulk action buttons here */}
        {onDelete && (
          <ActionBarItem variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 /> Delete
          </ActionBarItem>
        )}
      </ActionBarGroup>
    </ActionBar>
  );
}
```

Then add it to your main component's render:

```typescript
const selectedCellCount = tableMeta.selectionState?.selectedCells.size ?? 0;

// Inside your JSX:
<ProductsActionBar
  table={table}
  tableMeta={tableMeta}
  selectedCellCount={selectedCellCount}
  onDelete={() => {
    const selectedRows = table.getSelectedRowModel().rows;
    tableMeta.onRowsDelete?.(selectedRows.map((row) => row.index));
    table.toggleAllRowsSelected(false);
  }}
/>
```

---

## Step 11 — Page Wrapper

**File:** `src/app/(your-route)/page.tsx`

The page uses dynamic import with `ssr: false` because TanStack DB's `useLiveQuery` uses `useSyncExternalStore` which needs special SSR handling, and the collection preload triggers `fetch()` during prerendering:

```typescript
"use client";

import dynamic from "next/dynamic";
import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/components/data-grid/data-grid-skeleton";

export default dynamic(
  () =>
    import("./components/products-data-grid").then(
      (mod) => mod.ProductsDataGrid,
    ),
  {
    ssr: false,
    loading: () => (
      <DataGridSkeleton className="container flex flex-col gap-4 py-4">
        <DataGridSkeletonToolbar actionCount={4} />
        <DataGridSkeletonGrid />
      </DataGridSkeleton>
    ),
  },
);
```

---

## Full File Checklist

### Files to CREATE

| File | Required? |
|------|-----------|
| `src/app/(products)/lib/validation.ts` | ✅ Yes |
| `src/app/(products)/lib/collections.ts` | ✅ Yes (for optimistic UI) |
| `src/app/(products)/components/products-data-grid.tsx` | ✅ Yes |
| `src/app/(products)/components/products-action-bar.tsx` | Optional |
| `src/app/(products)/page.tsx` | ✅ Yes |
| `src/app/api/products/route.ts` | ✅ Yes |

### Files to MODIFY

| File | What to change |
|------|---------------|
| `src/db/schema.ts` | Add your table definition + types |
| `src/app/lib/utils.ts` | Add icon maps + random data generator |
| `src/app/lib/seeds.ts` | Add seed function |
| `src/db/seed.ts` | Register seed in `SEED_FUNCTIONS` |

### Total: **6 files to create + 4 files to modify = 10 files**

Minimal path (no undo/redo, no action bar, no seed, no icons):
**4 files to create + 1 file to modify = 5 files**

---

## Key Concepts Reference

### FilterPreset Type

```typescript
interface FilterPreset<TData> {
  id: string;                                                    // Unique ID
  label: string;                                                 // Button text
  icon?: React.ReactNode;                                        // Optional icon
  filters?: { id: keyof TData & string; value: unknown }[];     // Column filters
  columnVisibility?: Partial<Record<keyof TData & string, boolean>>; // Show/hide columns
  sorting?: { id: keyof TData & string; desc: boolean }[];      // Sort state
  className?: string;                                            // Inactive button Tailwind
  activeClassName?: string;                                      // Active button Tailwind
}
```

### Filter Value Types

| Column variant | Filter value type | Preset example |
|---------------|-------------------|---------------|
| `short-text` / `long-text` | `FilterValue` with text operators | Not typically used in presets |
| `number` | `FilterValue` with number operators | Not typically used in presets |
| `select` | `FilterValue` with select operators | `{ id: "category", value: "electronics" }` |
| `multi-select` | `FilterValue` with select operators | Same as select |
| `checkbox` | Raw `boolean` | `{ id: "inStock", value: true }` |
| `date` | `FilterValue` with date operators | Not typically used in presets |

> **Note:** Presets set raw column filter values. They bypass the operator-based filter UI. For simple presets, use raw values (like `true` or `"street"`). For operator-based filters, users use the `DataGridFilterMenu`.

### Collection API

```typescript
// Read (reactive)
const { data } = useLiveQuery((q) => q.from({ item: collection }).orderBy(...));

// Insert
collection.insert(newItem);

// Update single
collection.update(id, (draft) => { draft.name = "new name"; });

// Update batch
collection.update(ids, (drafts) => { for (const d of drafts) d.status = "active"; });

// Delete
collection.delete(id);
collection.delete([id1, id2, id3]);
```

### Keyboard Shortcuts (built-in)

| Shortcut | Action |
|----------|--------|
| `Cmd+F` | Open search (if `enableSearch`) |
| `Cmd+Z` | Undo (if undo/redo wired up) |
| `Cmd+Shift+Z` | Redo |
| `Cmd+C` | Copy selected cells |
| `Cmd+X` | Cut selected cells |
| `Cmd+V` | Paste (if `enablePaste`) |
| `Delete` / `Backspace` | Delete selected rows or clear cells |
| `Enter` | Start editing / confirm edit |
| `Escape` | Cancel editing / clear selection |
| `Tab` / `Shift+Tab` | Navigate cells |
| `Arrow keys` | Navigate cells |
| `Shift+Click` | Range select rows |
| `Shift+Arrow` | Extend cell selection |

---

## Troubleshooting & Gotchas

### 1. "getServerSnapshot" error
Your page MUST use `dynamic(() => ..., { ssr: false })`. TanStack DB's `useLiveQuery` uses `useSyncExternalStore` which fails during SSR.

### 2. Table name prefix
Use `pgTable` from `@/db/utils`, NOT from `drizzle-orm/pg-core`. The project's `pgTable` auto-prefixes table names with `tablecn_`.

### 3. `getFilterFn` is universal
Don't create separate filter functions per column type. `getFilterFn<TData>()` returns one function that handles ALL filter operators. Create once with `useMemo`, reuse everywhere.

### 4. `getAbsoluteUrl` in collections
The collection's `queryFn` runs on the client but `getAbsoluteUrl()` handles both client and server (Vercel) URLs. Always use it for fetch calls in collections.

### 5. `order` column
The demo uses an `order` integer column for manual row ordering. If you don't need drag-to-reorder, you can omit it, but having a stable sort tiebreaker is helpful.

### 6. Date fields
Drizzle timestamps come as `Date` objects. The Zod schema uses `z.coerce.date()` to handle JSON serialization (API returns ISO strings, Zod coerces them back to `Date`).

### 7. Nullable fields
If a column can be `null` (like `name`, `tags`), the schema must use `.nullable()` and the `onRowsAdd` function must set that field to `null` (not `undefined`).

### 8. `manualSorting: true`
When `manualSorting` is true, TanStack Table does NOT sort client-side. Your `useLiveQuery` must handle the sorting via `.orderBy()`. Without this, clicking column headers won't sort.

### 9. Column `id` must match `accessorKey`
The `id` and `accessorKey` on each column should be the same string, and must match a key of your data type. Filters, sorting, and presets all reference columns by `id`.

### 10. `data-grid-popover` attribute
The action bar and dropdowns inside the grid use `data-grid-popover` attribute. This prevents the grid from stealing focus when interacting with popovers.
