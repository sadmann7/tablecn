"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { DataGrid } from "@/components/data-grid/data-grid";

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
      },
      {
        id: "lastName",
        accessorKey: "lastName",
        header: "Last Name",
        size: 120,
      },
      {
        id: "age",
        accessorKey: "age",
        header: "Age",
        size: 80,
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        size: 220,
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Phone",
        size: 220,
      },
      {
        id: "company",
        accessorKey: "company",
        header: "Company",
        size: 220,
      },
      {
        id: "jobTitle",
        accessorKey: "jobTitle",
        header: "Job Title",
        size: 220,
      },
      {
        id: "city",
        accessorKey: "city",
        header: "City",
        size: 240,
      },
      {
        id: "country",
        accessorKey: "country",
        header: "Country",
        size: 240,
      },
    ],
    [],
  );

  const onDataChange = React.useCallback((newData: Person[]) => {
    setData(newData);
  }, []);

  const onRowAdd = React.useCallback(() => {
    const newId = data.length + 1;
    const newRow: Person = generatePerson(newId);
    setData((prev) => [...prev, newRow]);
  }, [data.length]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-2xl">Editable Data Grid Example</h2>
        <div className="text-muted-foreground text-sm">
          📊 {data.length} realistic employee records • ⚡ Virtualized rendering
          • 🖱️ Click any cell to edit • 📱 Horizontal scroll for more columns
        </div>
      </div>
      <DataGrid
        data={data}
        columns={columns}
        onDataChange={onDataChange}
        getRowId={(row) => row.id}
        onRowAdd={onRowAdd}
        height={500}
      />
      <div className="mt-4 text-muted-foreground text-sm">
        💡 Tip: Scroll to see virtualization in action - only visible rows are
        rendered in the DOM
      </div>
    </div>
  );
}
