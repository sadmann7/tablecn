"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { DataGrid } from "@/components/data-grid/data-grid";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { useDataGrid } from "@/hooks/use-data-grid";

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  salary: number;
  department: string;
  status: string;
  isActive: boolean;
  startDate: string;
  jobTitle: string;
}

faker.seed(12345);

const departments = ["Engineering", "Marketing", "Sales", "HR", "Finance"];
const statuses = ["Active", "On Leave", "Remote", "In Office"];

function generatePerson(id: number): Person {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    id: id.toString(),
    firstName,
    lastName,
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
    jobTitle: faker.person.jobTitle(),
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
        id: "firstName",
        accessorKey: "firstName",
        header: "First Name",
        size: 150,
        meta: {
          label: "First Name",
          cell: {
            variant: "text",
            placeholder: "Enter first name",
          },
        },
      },
      {
        id: "lastName",
        accessorKey: "lastName",
        header: "Last Name",
        size: 150,
        meta: {
          label: "Last Name",
          cell: {
            variant: "text",
            placeholder: "Enter last name",
          },
        },
      },
      {
        id: "age",
        accessorKey: "age",
        header: "Age",
        size: 100,
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
        size: 240,
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
        size: 120,
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
        size: 150,
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
        size: 130,
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
        size: 100,
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
        size: 150,
        meta: {
          label: "Start Date",
          cell: {
            variant: "date",
            placeholder: "Select date",
          },
        },
      },
      {
        id: "jobTitle",
        accessorKey: "jobTitle",
        header: "Job Title",
        size: 200,
        meta: {
          label: "Job Title",
          cell: {
            variant: "text",
            placeholder: "Enter job title",
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
      columnId: "firstName",
    };
  }, [data.length]);

  const { gridRef, table, rowVirtualizer, scrollToRow } = useDataGrid({
    data,
    columns,
    onDataChange: setData,
    getRowId: (row) => row.id,
    enableSorting: true,
    estimateRowSize: 35,
    overscan: 3,
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="ml-auto flex items-center gap-2"
      >
        <DataTableSortList table={table} align="end" />
        <DataTableViewOptions table={table} align="end" />
      </div>
      <DataGrid
        gridRef={gridRef}
        table={table}
        rowVirtualizer={rowVirtualizer}
        scrollToRow={scrollToRow}
        onRowAdd={onRowAdd}
        height={500}
      />
    </div>
  );
}
