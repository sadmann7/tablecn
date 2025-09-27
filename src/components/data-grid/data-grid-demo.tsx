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
  phone: string;
  company: string;
  jobTitle: string;
  city: string;
  country: string;
}

faker.seed(12345);

function generatePerson(id: number): Person {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    id: id.toString(),
    firstName,
    lastName,
    age: faker.number.int({ min: 22, max: 65 }),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    phone: faker.phone.number(),
    company: faker.company.name(),
    jobTitle: faker.person.jobTitle(),
    city: faker.location.city(),
    country: faker.location.country(),
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
        size: 120,
        meta: { label: "First Name" },
      },
      {
        id: "lastName",
        accessorKey: "lastName",
        header: "Last Name",
        size: 120,
        meta: { label: "Last Name" },
      },
      {
        id: "age",
        accessorKey: "age",
        header: "Age",
        size: 80,
        meta: { label: "Age" },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        size: 220,
        meta: { label: "Email" },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Phone",
        size: 220,
        meta: { label: "Phone" },
      },
      {
        id: "company",
        accessorKey: "company",
        header: "Company",
        size: 220,
        meta: { label: "Company" },
      },
      {
        id: "jobTitle",
        accessorKey: "jobTitle",
        header: "Job Title",
        size: 220,
        meta: { label: "Job Title" },
      },
      {
        id: "city",
        accessorKey: "city",
        header: "City",
        size: 240,
        meta: { label: "City" },
      },
      {
        id: "country",
        accessorKey: "country",
        header: "Country",
        size: 240,
        meta: { label: "Country" },
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
