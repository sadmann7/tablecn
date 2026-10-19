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
  CircleX,
  type LucideIcon,
  Timer,
} from "lucide-react";

import { type Skater, type Task, tasks } from "@/db/schema";
import { ColumnFilterItem } from "@/lib/data-table-types";
import { generateId } from "@/lib/id";

export function generateTaskCode(takenCodes?: Set<string>): string {
  let code: string;
  do {
    code = `TASK-${generateId({ alphabet: "0123456789", length: 4 })}`;
  } while (takenCodes?.has(code));
  return code;
}

export function generateRandomTask(input?: Partial<Task>): Task {
  const createdAt = faker.date.recent({ days: 30 });

  return {
    id: generateId("task"),
    code: generateTaskCode(),
    title: faker.hacker
      .phrase()
      .replace(/^./, (letter) => letter.toUpperCase()),
    estimatedHours: faker.number.int({ min: 1, max: 24 }),
    status: faker.helpers.shuffle(tasks.status.enumValues)[0] ?? "todo",
    label: faker.helpers.shuffle(tasks.label.enumValues)[0] ?? "bug",
    priority: faker.helpers.shuffle(tasks.priority.enumValues)[0] ?? "low",
    archived: faker.datatype.boolean({ probability: 0.2 }),
    createdAt,
    updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
    ...input,
  };
}

export function generateRandomTasks(
  count: number,
  takenCodes: Iterable<string> = [],
): Task[] {
  const codes = new Set(takenCodes);

  return Array.from({ length: count }, () => {
    const code = generateTaskCode(codes);
    codes.add(code);
    return generateRandomTask({ code });
  });
}

export function getStatusIcon(status: Task["status"]) {
  const statusIcons: Record<Task["status"], LucideIcon> = {
    canceled: CircleX,
    done: CheckCircle2,
    "in-progress": Timer,
    todo: CircleHelp,
  };

  return statusIcons[status];
}

export function getPriorityIcon(priority: Task["priority"]) {
  const priorityIcons: Record<Task["priority"], LucideIcon> = {
    high: ArrowUpIcon,
    low: ArrowDownIcon,
    medium: ArrowRightIcon,
  };

  return priorityIcons[priority];
}

export function getLabelIcon(label: Task["label"]) {
  const labelIcons: Record<Task["label"], LucideIcon> = {
    bug: Bug,
    feature: Circle,
    enhancement: CircleCheck,
    documentation: Book,
  };

  return labelIcons[label];
}

const ENUM_COLUMNS = {
  status: tasks.status.enumValues,
  priority: tasks.priority.enumValues,
  label: tasks.label.enumValues,
} as const;

export function sanitizeEnumFilters<TColumnId extends string>(
  filters: ColumnFilterItem<TColumnId>[],
) {
  return filters.flatMap((filter) => {
    const allowed: readonly string[] | undefined =
      ENUM_COLUMNS[filter.id as keyof typeof ENUM_COLUMNS];
    if (!allowed) return [filter];

    const values = (
      Array.isArray(filter.value) ? filter.value : [filter.value]
    ).filter((value) => allowed.includes(value));

    if (values.length === 0) return [];

    return [
      {
        ...filter,
        value: Array.isArray(filter.value) ? values : (values[0] ?? ""),
      },
    ];
  });
}

export function getSkaterStatusIcon(status: Skater["status"]) {
  const statusIcons: Record<NonNullable<Skater["status"]>, LucideIcon> = {
    amateur: Circle,
    sponsored: Timer,
    pro: CheckCircle2,
    legend: CircleCheck,
  };

  return status ? statusIcons[status] : undefined;
}

export function getStanceIcon(stance: Skater["stance"]) {
  const stanceIcons: Record<NonNullable<Skater["stance"]>, LucideIcon> = {
    regular: ArrowRightIcon,
    goofy: ArrowDownIcon,
  };

  return stance ? stanceIcons[stance] : undefined;
}

export function getStyleIcon(style: Skater["style"]) {
  const styleIcons: Record<NonNullable<Skater["style"]>, LucideIcon> = {
    street: CircleCheck,
    vert: ArrowUpIcon,
    park: Circle,
    freestyle: CircleHelp,
    "all-around": CheckCircle2,
  };

  return style ? styleIcons[style] : undefined;
}
