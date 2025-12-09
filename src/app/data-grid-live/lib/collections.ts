"use client";

import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { type EmployeeSchema, employeeSchema } from "./validation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  },
});

export const employeesCollection = createCollection(
  queryCollectionOptions({
    id: "employees",
    queryKey: ["employees"],
    queryClient,
    queryFn: async (): Promise<EmployeeSchema[]> => {
      const response = await fetch("/api/employees");
      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }
      const data = employeeSchema.array().safeParse(await response.json()).data;

      if (!data) {
        throw new Error("Failed to parse employees");
      }

      return data;
    },
    getKey: (item: EmployeeSchema) => item.id,
    schema: employeeSchema,
    onInsert: async ({ transaction }) => {
      const employeesToInsert = transaction.mutations
        .map((m) => m?.modified)
        .filter((modified): modified is EmployeeSchema => modified != null)
        .map(
          ({
            // Exclude auto-generated fields
            id: _id,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...data
          }) => data,
        );

      if (employeesToInsert.length === 0) return;

      // Use bulk insert - single DB query for all inserts
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: employeesToInsert }),
      });

      if (!response.ok) {
        throw new Error("Failed to create employees");
      }
    },
    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations
        .filter(
          (
            m,
          ): m is typeof m & {
            key: string;
            changes: Partial<EmployeeSchema>;
          } => m?.key != null && m?.changes != null,
        )
        .map((m) => ({ id: m.key, changes: m.changes }));

      if (updates.length === 0) return;

      // Use bulk update - optimized for same-changes case
      const response = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update employees");
      }
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations
        .map((m) => m?.key)
        .filter((id): id is string => id != null);

      if (ids.length === 0) return;

      // Use bulk delete - single DB query for all deletes
      const response = await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete employees");
      }
    },
  }),
);
