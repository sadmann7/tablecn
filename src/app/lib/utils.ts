import { faker } from "@faker-js/faker";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  Book,
  Bug,
  CheckCircle2,
  Circle,
  CircleCheck,
  CircleHelp,
  CircleIcon,
  CircleX,
  Timer,
} from "lucide-react";
import { customAlphabet } from "nanoid";
import { type Task, tasks } from "@/db/schema";

import { generateId } from "@/lib/id";

const availableTags = [
  "frontend",
  "backend",
  "api",
  "database",
  "ui",
  "ux",
  "performance",
  "security",
  "testing",
  "deployment",
] as const;

const sampleFiles = [
  { name: "spec.pdf", type: "application/pdf", sizeRange: [50, 500] },
  { name: "design.pdf", type: "application/pdf", sizeRange: [100, 300] },
  { name: "screenshot.jpg", type: "image/jpeg", sizeRange: [200, 800] },
  { name: "mockup.png", type: "image/png", sizeRange: [300, 1000] },
  {
    name: "notes.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeRange: [50, 200],
  },
  {
    name: "data.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeRange: [100, 400],
  },
] as const;

export function generateRandomTask(input?: Partial<Task>): Task {
  // Generate random tags (0-4 tags)
  const tagCount = faker.number.int({ min: 0, max: 4 });
  const tags =
    tagCount > 0
      ? faker.helpers.arrayElements([...availableTags], tagCount)
      : null;

  // Generate random files (0-2 files, 30% chance of having files)
  const hasFiles = faker.datatype.boolean({ probability: 0.3 });
  const files = hasFiles
    ? faker.helpers
        .arrayElements(sampleFiles, { min: 1, max: 2 })
        .map((file, index) => ({
          id: `file-${generateId("file")}-${index}`,
          name: file.name,
          size:
            faker.number.int({
              min: file.sizeRange[0],
              max: file.sizeRange[1],
            }) * 1024,
          type: file.type,
          url: `https://example.com/files/${file.name}`,
        }))
    : null;

  return {
    id: generateId("task"),
    code: `TASK-${customAlphabet("0123456789", 4)()}`,
    title: faker.hacker
      .phrase()
      .replace(/^./, (letter) => letter.toUpperCase()),
    estimatedHours: faker.number.int({ min: 1, max: 24 }),
    status: faker.helpers.shuffle(tasks.status.enumValues)[0] ?? "todo",
    label: faker.helpers.shuffle(tasks.label.enumValues)[0] ?? "bug",
    priority: faker.helpers.shuffle(tasks.priority.enumValues)[0] ?? "low",
    archived: faker.datatype.boolean({ probability: 0.2 }),
    tags,
    files,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
}

export function getStatusIcon(status: Task["status"]) {
  const statusIcons = {
    canceled: CircleX,
    done: CheckCircle2,
    "in-progress": Timer,
    todo: CircleHelp,
  };

  return statusIcons[status] || CircleIcon;
}

export function getPriorityIcon(priority: Task["priority"]) {
  const priorityIcons = {
    high: ArrowUpIcon,
    low: ArrowDownIcon,
    medium: ArrowRightIcon,
  };

  return priorityIcons[priority] || CircleIcon;
}

export function getLabelIcon(label: Task["label"]) {
  const labelIcons = {
    bug: Bug,
    feature: Circle,
    enhancement: CircleCheck,
    documentation: Book,
  };

  return labelIcons[label] || CircleIcon;
}
