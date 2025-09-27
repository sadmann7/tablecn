"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { DataGrid } from "@/components/data-grid/data-grid";
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

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-2xl">Editable Data Grid Example</h2>
        <div className="text-muted-foreground text-sm">
          📊 {data.length} realistic employee records • ⚡ Virtualized rendering
          • 🖱️ Click any cell to edit • 🔲 Cell selection with Ctrl/Shift • 📱
          Horizontal scroll for more columns • 🔄 Multiple column sorting
        </div>
      </div>
      <DataGrid
        data={data}
        columns={columns}
        onDataChange={setData}
        getRowId={(row) => row.id}
        onRowAdd={onRowAdd}
        height={600}
      />
      <div className="mt-4 text-muted-foreground text-sm">
        💡 Tips: Click column headers to access sorting options. Use the Sort
        button to manage multiple sorts. Scroll to see virtualization in action
        - only visible rows are rendered in the DOM. Try cell selection:
        Ctrl+click for multi-select, Shift+click for range selection,
        Shift+arrows for keyboard range selection, Ctrl+A to select all, Delete
        to clear selected cells.
      </div>
    </div>
  );
}
