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
