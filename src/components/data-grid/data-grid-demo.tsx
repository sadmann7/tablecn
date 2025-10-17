"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { DataGrid } from "@/components/data-grid/data-grid";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataGrid } from "@/hooks/use-data-grid";

interface Person {
  id: string;
  name: string;
  age: number;
  email: string;
  salary: number;
  department: string;
  status: string;
  isActive: boolean;
  startDate: string;
}

faker.seed(12345);

const departments = [
  "Engineering",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
] as const;
const statuses = ["Active", "On Leave", "Remote", "In Office"] as const;

function generatePerson(id: number): Person {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id: id.toString(),
    name: `${firstName} ${lastName}`,
    age: faker.number.int({ min: 22, max: 65 }),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    salary: faker.number.int({ min: 40000, max: 150000 }),
    department: faker.helpers.arrayElement(departments),
    status: faker.helpers.arrayElement(statuses),
    isActive: faker.datatype.boolean(),
    startDate:
      faker.date
        .between({ from: "2018-01-01", to: "2024-01-01" })
        .toISOString()
        .split("T")[0] ?? "",
  };
}

const initialData: Person[] = Array.from({ length: 1000 }, (_, i) =>
  generatePerson(i + 1),
);

export function DataGridDemo() {
  const [data, setData] = React.useState<Person[]>(initialData);

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-0.5"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-0.5"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        minSize: 180,
        meta: {
          label: "Name",
          cell: {
            variant: "text",
            placeholder: "Enter name",
          },
        },
      },
      {
        id: "age",
        accessorKey: "age",
        header: "Age",
        minSize: 100,
        meta: {
          label: "Age",
          cell: {
            variant: "number",
            min: 18,
            max: 100,
            step: 1,
            placeholder: "Age",
          },
        },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        minSize: 240,
        meta: {
          label: "Email",
          cell: {
            variant: "text",
            placeholder: "email@example.com",
          },
        },
      },
      {
        id: "salary",
        accessorKey: "salary",
        header: "Salary",
        minSize: 180,
        meta: {
          label: "Salary",
          cell: {
            variant: "number",
            min: 0,
            step: 1000,
            placeholder: "Salary",
          },
        },
      },
      {
        id: "department",
        accessorKey: "department",
        header: "Department",
        minSize: 180,
        meta: {
          label: "Department",
          cell: {
            variant: "select",
            options: departments.map((dept) => ({
              label: dept,
              value: dept,
            })),
            placeholder: "Select department",
          },
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        minSize: 180,
        meta: {
          label: "Status",
          cell: {
            variant: "select",
            options: statuses.map((status) => ({
              label: status,
              value: status,
            })),
            placeholder: "Select status",
          },
        },
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: "Active",
        minSize: 140,
        meta: {
          label: "Active",
          cell: {
            variant: "checkbox",
          },
        },
      },
      {
        id: "startDate",
        accessorKey: "startDate",
        header: "Start Date",
        minSize: 150,
        meta: {
          label: "Start Date",
          cell: {
            variant: "date",
            placeholder: "Select date",
          },
        },
      },
    ],
    [],
  );

  const onRowAdd = React.useCallback(() => {
    const newId = data.length + 1;
    const newRow: Person = generatePerson(newId);
    setData((prev) => [...prev, newRow]);

    return {
      rowIndex: data.length,
      columnId: "name",
    };
  }, [data.length]);

  const { table, ...dataGridProps } = useDataGrid({
    columns,
    data,
    onDataChange: setData,
    getRowId: (row) => row.id,
    enableSearch: true,
    initialState: {
      columnPinning: {
        left: ["select", "name"],
      },
    },
  });

  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        {selectedRowsCount > 0 ? (
          <div className="text-muted-foreground text-sm">
            {selectedRowsCount} of {table.getFilteredRowModel().rows.length}{" "}
            row(s) selected
          </div>
        ) : (
          <div />
        )}
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex items-center gap-2"
        >
          <DataTableSortList table={table} align="end" />
          <DataTableViewOptions table={table} align="end" />
        </div>
      </div>
      <DataGrid
        table={table}
        {...dataGridProps}
        onRowAdd={onRowAdd}
        height={560}
      />
    </div>
  );
}
