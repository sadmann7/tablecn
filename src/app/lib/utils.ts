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
import { type Employee, employees, type Task, tasks } from "@/db/schema";

import { generateId } from "@/lib/id";

// Task utilities for data-table demo
export function generateRandomTask(input?: Partial<Task>): Task {
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

// Employee utilities for data-grid-live demo
const availableSkills = [
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

const sampleDocuments = [
  { name: "resume.pdf", type: "application/pdf", sizeRange: [50, 500] },
  { name: "contract.pdf", type: "application/pdf", sizeRange: [100, 300] },
  { name: "id_document.jpg", type: "image/jpeg", sizeRange: [200, 800] },
  { name: "profile_photo.png", type: "image/png", sizeRange: [300, 1000] },
  {
    name: "certification.pdf",
    type: "application/pdf",
    sizeRange: [50, 200],
  },
] as const;

export function generateRandomEmployee(input?: Partial<Employee>): Employee {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  // Generate random skills (0-5 skills)
  const skillCount = faker.number.int({ min: 0, max: 5 });
  const skills =
    skillCount > 0
      ? faker.helpers.arrayElements([...availableSkills], skillCount)
      : null;

  // Generate random documents (0-2 files, 30% chance of having documents)
  const hasDocuments = faker.datatype.boolean({ probability: 0.3 });
  const documents = hasDocuments
    ? faker.helpers
        .arrayElements(sampleDocuments, { min: 1, max: 2 })
        .map((doc, index) => ({
          id: `doc-${generateId("doc")}-${index}`,
          name: doc.name,
          size:
            faker.number.int({
              min: doc.sizeRange[0],
              max: doc.sizeRange[1],
            }) * 1024,
          type: doc.type,
          url: `https://example.com/documents/${doc.name}`,
        }))
    : null;

  return {
    id: generateId("emp"),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    department:
      faker.helpers.shuffle(employees.department.enumValues)[0] ??
      "engineering",
    role: faker.helpers.shuffle(employees.role.enumValues)[0] ?? "developer",
    status: faker.helpers.shuffle(employees.status.enumValues)[0] ?? "active",
    salary: faker.number.int({ min: 40000, max: 200000 }),
    startDate: faker.date.between({ from: "2018-01-01", to: "2024-01-01" }),
    isVerified: faker.datatype.boolean({ probability: 0.7 }),
    skills,
    documents,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
}

export function getEmployeeStatusIcon(status: Employee["status"]) {
  const statusIcons = {
    active: CheckCircle2,
    inactive: CircleX,
    "on-leave": Timer,
    remote: Circle,
  };

  return statusIcons[status] || CircleIcon;
}

export function getDepartmentIcon(department: Employee["department"]) {
  const departmentIcons = {
    engineering: CircleCheck,
    marketing: Circle,
    sales: ArrowUpIcon,
    hr: CircleHelp,
    finance: Book,
  };

  return departmentIcons[department] || CircleIcon;
}

export function getRoleIcon(role: Employee["role"]) {
  const roleIcons = {
    admin: CheckCircle2,
    manager: ArrowUpIcon,
    developer: CircleCheck,
    designer: Circle,
    analyst: Book,
  };

  return roleIcons[role] || CircleIcon;
}
