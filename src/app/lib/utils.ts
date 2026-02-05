import { faker } from "@faker-js/faker";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckCircle2,
  Circle,
  CircleCheck,
  CircleHelp,
  type LucideIcon,
  Timer,
} from "lucide-react";
import { type Skater, skaters } from "@/db/schema";

import { generateId } from "@/lib/id";

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

export function generateRandomSkater(input?: Partial<Skater>): Skater {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  const trickCount = faker.number.int({ min: 0, max: 8 });
  const tricks =
    trickCount > 0
      ? faker.helpers.arrayElements([...availableTricks], trickCount)
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
    order: 0,
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
