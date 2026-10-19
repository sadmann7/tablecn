import { faker } from "@faker-js/faker";

import type { RowPayload } from "./types";

import {
  SEED_FILE_ID_PREFIX,
  STANCES,
  STATUSES,
  STYLES,
  TRICKS,
} from "./constants";

const SAMPLE_MEDIA = [
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

function generateSeedMedia() {
  if (!faker.datatype.boolean({ probability: 0.3 })) return null;

  return faker.helpers
    .arrayElements(SAMPLE_MEDIA, { min: 1, max: 2 })
    .map((file) => ({
      id: `${SEED_FILE_ID_PREFIX}${faker.string.alphanumeric(10)}`,
      name: file.name,
      size:
        faker.number.int({ min: file.sizeRange[0], max: file.sizeRange[1] }) *
        1024,
      type: file.type,
      url: `https://example.com/media/${file.name}`,
    }));
}

function generateSeedRow(order: number): RowPayload {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const trickCount = faker.number.int({ min: 0, max: 6 });
  const now = new Date().toISOString();

  return {
    id: faker.string.alphanumeric(11),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    stance: faker.helpers.arrayElement([...STANCES]),
    style: faker.helpers.arrayElement([...STYLES]),
    status: faker.helpers.arrayElement([...STATUSES]),
    yearsSkating: faker.number.int({ min: 1, max: 25 }),
    startedSkating: faker.date
      .between({ from: "2000-01-01", to: "2023-01-01" })
      .toISOString(),
    isPro: faker.datatype.boolean({ probability: 0.3 }),
    tricks:
      trickCount > 0
        ? faker.helpers.arrayElements([...TRICKS], trickCount)
        : null,
    media: generateSeedMedia(),
    order,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeedRows(): RowPayload[] {
  return Array.from({ length: 20 }, (_, i) => generateSeedRow(i + 1));
}
