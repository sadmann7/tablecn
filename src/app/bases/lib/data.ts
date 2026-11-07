import { base, en, Faker } from "@faker-js/faker";

import { type Task, tasks } from "@/db/schema";

export const BASES = [
  { value: "radix", label: "Radix UI" },
  { value: "base", label: "Base UI" },
  { value: "aria", label: "React Aria" },
] as const;

export type Base = (typeof BASES)[number]["value"];

export function isBase(value: string): value is Base {
  return BASES.some((base) => base.value === value);
}

const REFERENCE_DATE = new Date("2026-11-01T00:00:00.000Z");

const faker = new Faker({ locale: [en, base] });
faker.seed(20261101);

export const basesTasks: Task[] = Array.from({ length: 100 }, (_, index) => {
  const createdAt = faker.date.recent({ days: 30, refDate: REFERENCE_DATE });

  return {
    id: `task-${index}`,
    code: `TASK-${String(1000 + index)}`,
    title: faker.hacker
      .phrase()
      .replace(/^./, (letter) => letter.toUpperCase()),
    estimatedHours: faker.number.int({ min: 1, max: 24 }),
    status: faker.helpers.arrayElement(tasks.status.enumValues),
    label: faker.helpers.arrayElement(tasks.label.enumValues),
    priority: faker.helpers.arrayElement(tasks.priority.enumValues),
    archived: faker.datatype.boolean({ probability: 0.2 }),
    createdAt,
    updatedAt: faker.date.between({ from: createdAt, to: REFERENCE_DATE }),
  };
});
