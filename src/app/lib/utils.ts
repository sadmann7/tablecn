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
import { customAlphabet } from "nanoid";
import { type Skater, skaters, type Task, tasks } from "@/db/schema";

import { generateId } from "@/lib/id";

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

const availableTricks = [
  "Kickflip",
  "Heelflip",
  "Tre Flip",
  "Hardflip",
  "Varial Flip",
  "360 Flip",
  "Ollie",
  "Nollie",
  "Pop Shove-it",
  "FS Boardslide",
  "BS Boardslide",
  "50-50 Grind",
  "5-0 Grind",
  "Crooked Grind",
  "Smith Grind",
] as const;

const sampleMedia = [
  { name: "trick_clip.mp4", type: "video/mp4", sizeRange: [5000, 50000] },
  { name: "skate_edit.mp4", type: "video/mp4", sizeRange: [10000, 100000] },
  { name: "photo_1.jpg", type: "image/jpeg", sizeRange: [500, 3000] },
  { name: "photo_2.jpg", type: "image/jpeg", sizeRange: [500, 3000] },
  {
    name: "sponsor_contract.pdf",
    type: "application/pdf",
    sizeRange: [100, 500],
  },
] as const;

export function generateRandomSkater(input?: Partial<Skater>): Skater {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  const trickCount = faker.number.int({ min: 0, max: 8 });
  const tricks =
    trickCount > 0
      ? faker.helpers.arrayElements([...availableTricks], trickCount)
      : null;

  const hasMedia = faker.datatype.boolean({ probability: 0.3 });
  const media = hasMedia
    ? faker.helpers
        .arrayElements(sampleMedia, { min: 1, max: 2 })
        .map((file, index) => ({
          id: `media-${generateId("media")}-${index}`,
          name: file.name,
          size:
            faker.number.int({
              min: file.sizeRange[0],
              max: file.sizeRange[1],
            }) * 1024,
          type: file.type,
          url: `https://example.com/media/${file.name}`,
        }))
    : null;

  return {
    id: generateId("skater"),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    stance: faker.helpers.shuffle(skaters.stance.enumValues)[0] ?? "regular",
    style: faker.helpers.shuffle(skaters.style.enumValues)[0] ?? "street",
    status: faker.helpers.shuffle(skaters.status.enumValues)[0] ?? "amateur",
    yearsSkating: faker.number.int({ min: 1, max: 25 }),
    startedSkating: faker.date.between({
      from: "2000-01-01",
      to: "2023-01-01",
    }),
    isPro: faker.datatype.boolean({ probability: 0.3 }),
    tricks,
    media,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
}

export function getSkaterStatusIcon(status: Skater["status"]) {
  const statusIcons: Record<Skater["status"], LucideIcon> = {
    amateur: Circle,
    sponsored: Timer,
    pro: CheckCircle2,
    legend: CircleCheck,
  };

  return statusIcons[status];
}

export function getStanceIcon(stance: Skater["stance"]) {
  const stanceIcons: Record<Skater["stance"], LucideIcon> = {
    regular: ArrowRightIcon,
    goofy: ArrowDownIcon,
  };

  return stanceIcons[stance];
}

export function getStyleIcon(style: Skater["style"]) {
  const styleIcons: Record<Skater["style"], LucideIcon> = {
    street: CircleCheck,
    vert: ArrowUpIcon,
    park: Circle,
    freestyle: CircleHelp,
    "all-around": CheckCircle2,
  };

  return styleIcons[style];
}
