"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import type { FileCellData } from "@/types/data-grid";

interface Person {
  id: string;
  name?: string;
  age?: number;
  email?: string;
  website?: string;
  notes?: string;
  salary?: number;
  department?: string;
  status?: string;
  skills?: string[];
  isActive?: boolean;
  startDate?: string;
  attachments?: FileCellData[];
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

const sampleFiles = [
  { name: "Resume.pdf", type: "application/pdf", sizeRange: [50, 500] },
  { name: "Contract.pdf", type: "application/pdf", sizeRange: [100, 300] },
  { name: "ID_Document.pdf", type: "application/pdf", sizeRange: [200, 400] },
  { name: "Profile_Photo.jpg", type: "image/jpeg", sizeRange: [500, 2000] },
  {
    name: "Presentation.pptx",
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    sizeRange: [1000, 5000],
  },
  {
    name: "Report.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeRange: [100, 800],
  },
  {
    name: "Timesheet.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeRange: [50, 200],
  },
  { name: "Certificate.pdf", type: "application/pdf", sizeRange: [200, 500] },
  {
    name: "Background_Check.pdf",
    type: "application/pdf",
    sizeRange: [300, 600],
  },
  { name: "Training_Video.mp4", type: "video/mp4", sizeRange: [5000, 15000] },
] as const;

function generatePerson(id: number): Person {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  // Generate 0-3 files for this person
  const fileCount = faker.number.int({ min: 0, max: 3 });
  const selectedFiles = faker.helpers.arrayElements(sampleFiles, fileCount);

  const attachments: FileCellData[] = selectedFiles.map((file, index) => {
    const sizeKB = faker.number.int({
      min: file.sizeRange[0],
      max: file.sizeRange[1],
    });
    return {
      id: `${id}-file-${index}`,
      name: file.name,
      size: sizeKB * 1024, // Convert to bytes
      type: file.type,
      url: `https://example.com/files/${id}/${file.name}`,
    };
  });

  return {
    id: id.toString(),
    name: `${firstName} ${lastName}`,
    age: faker.number.int({ min: 22, max: 65 }),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    website: faker.internet.url().replace(/\/$/, ""),
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
    attachments,
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
        id: "website",
        accessorKey: "website",
        header: "Website",
        minSize: 240,
        meta: {
          label: "Website",
          cell: {
            variant: "url",
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
      {
        id: "attachments",
        accessorKey: "attachments",
        header: "Attachments",
        minSize: 240,
        meta: {
          label: "Attachments",
          cell: {
            variant: "file",
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            accept:
              "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
            multiple: true,
          },
        },
      },
    ],
    [],
  );

  const onRowAdd: NonNullable<UseDataGridProps<Person>["onRowAdd"]> =
    React.useCallback(() => {
      // In a real app, you would make a server call here:
      // await fetch('/api/people', {
      //   method: 'POST',
      //   body: JSON.stringify({ name: 'New Person' })
      // });

      // For this demo, just add a new row to the data
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

  const onRowsDelete: NonNullable<UseDataGridProps<Person>["onRowsDelete"]> =
    React.useCallback((rows) => {
      // In a real app, you would make a server call here:
      // await fetch('/api/people', {
      //   method: 'DELETE',
      //   body: JSON.stringify({ ids: rows.map(r => r.id) })
      // });

      // For this demo, just filter out the deleted rows
      setData((prev) => prev.filter((row) => !rows.includes(row)));
    }, []);

  const { table, ...dataGridProps } = useDataGrid({
    columns,
    data,
    onDataChange: setData,
    onRowAdd,
    onRowsDelete,
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
      <DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
      <DataGrid {...dataGridProps} table={table} height={height} />
    </div>
  );
}
