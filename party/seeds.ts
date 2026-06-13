import { faker } from "@faker-js/faker";
import { STANCES, STATUSES, STYLES, TRICKS } from "./constants";
import type { RowPayload } from "./types";

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
    media: null,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

export const seedRows: RowPayload[] = Array.from({ length: 20 }, (_, i) =>
  generateSeedRow(i + 1),
);
