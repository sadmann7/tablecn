"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";

interface Person {
  id: string;
  name?: string;
  age?: number;
  email?: string;
  notes?: string;
  salary?: number;
  department?: string;
  status?: string;
  skills?: string[];
  isActive?: boolean;
  startDate?: string;
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
const skills = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "SQL",
  "AWS",
  "Docker",
  "Git",
  "Agile",
] as const;

const notes = [
  "Excellent team player with strong communication skills. Consistently meets deadlines and delivers high-quality work.",
  "Currently working on the Q4 project initiative. Requires additional training in advanced analytics tools.",
  "Relocated from the Seattle office last month. Adjusting well to the new team dynamics and company culture.",
  "Submitted request for professional development courses. Shows great initiative in learning new technologies.",
  "Outstanding performance in the last quarter. Recommended for leadership training program next year.",
  "Recently completed certification in project management. Looking to take on more responsibility in upcoming projects.",
  "Needs improvement in time management. Working with mentor to develop better organizational skills.",
  "Transferred from the marketing department. Bringing valuable cross-functional experience to the team.",
  "On track for promotion consideration. Has exceeded expectations in client relationship management.",
  "Participating in the company mentorship program. Showing strong potential for career advancement.",
  "Recently returned from parental leave. Successfully reintegrated into current project workflows.",
  "Fluent in three languages. Often assists with international client communications and translations.",
  "Leading the diversity and inclusion initiative. Organizing monthly team building events and workshops.",
  "Requested flexible work arrangement for family care. Maintaining productivity while working remotely.",
  "Completed advanced training in data visualization. Now serving as the team's go-to expert for dashboards.",
];

function generatePerson(id: number): Person {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id: id.toString(),
    name: `${firstName} ${lastName}`,
    age: faker.number.int({ min: 22, max: 65 }),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    notes: faker.helpers.arrayElement(notes),
    salary: faker.number.int({ min: 40000, max: 150000 }),
    department: faker.helpers.arrayElement(departments),
    status: faker.helpers.arrayElement(statuses),
    isActive: faker.datatype.boolean(),
    startDate:
      faker.date
        .between({ from: "2018-01-01", to: "2024-01-01" })
        .toISOString()
        .split("T")[0] ?? "",
    skills: faker.helpers.arrayElements(skills, { min: 1, max: 5 }),
  };
}

const initialData: Person[] = Array.from({ length: 1000 }, (_, i) =>
  generatePerson(i + 1),
);

export function DataGridDemo() {
  const [data, setData] = React.useState<Person[]>(initialData);
  const windowSize = useWindowSize({ defaultHeight: 760 });

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row, table }) => (
          <Checkbox
            aria-label="Select row"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => {
              const onRowSelect = table.options.meta?.onRowSelect;
              if (onRowSelect) {
                onRowSelect(row.index, !!value, false);
              } else {
                row.toggleSelected(!!value);
              }
            }}
            onClick={(event: React.MouseEvent) => {
              if (event.shiftKey) {
                event.preventDefault();
                const onRowSelect = table.options.meta?.onRowSelect;
                if (onRowSelect) {
                  onRowSelect(row.index, !row.getIsSelected(), true);
                }
              }
            }}
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        minSize: 180,
        meta: {
          label: "Name",
          cell: {
            variant: "short-text",
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
            variant: "short-text",
          },
        },
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        minSize: 200,
        meta: {
          label: "Notes",
          cell: {
            variant: "long-text",
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
          },
        },
      },
      {
        id: "skills",
        accessorKey: "skills",
        header: "Skills",
        minSize: 240,
        meta: {
          label: "Skills",
          cell: {
            variant: "multi-select",
            options: skills.map((skill) => ({
              label: skill,
              value: skill,
            })),
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
          },
        },
      },
    ],
    [],
  );

  const onRowAdd = React.useCallback(() => {
    const newId = data.length + 1;
    setData((prev) => [
      ...prev,
      {
        id: newId.toString(),
      },
    ]);

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
    initialState: {
      columnPinning: {
        left: ["select"],
      },
    },
    enableSearch: true,
  });

  const height = Math.max(400, windowSize.height - 150);

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        <DataGridSortMenu table={table} align="end" />
        <DataGridRowHeightMenu table={table} align="end" />
        <DataGridViewMenu table={table} align="end" />
      </div>
      <DataGrid
        {...dataGridProps}
        table={table}
        onRowAdd={onRowAdd}
        height={height}
      />
    </div>
  );
}
