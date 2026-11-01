import { faker } from "@faker-js/faker";

import type { FileCellData } from "@/lib/data-grid-types";

export interface Person {
  id: string;
  name?: string;
  age?: number;
  email?: string;
  website?: string;
  feedback?: string;
  salary?: number;
  department?: string;
  status?: string;
  skills?: string[];
  isActive?: boolean;
  startDate?: string;
  attachments?: FileCellData[];
}

faker.seed(12345);

export const departments = [
  "Engineering",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
] as const;

export const statuses = ["Active", "On Leave", "Remote", "In Office"] as const;

export const skills = [
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

interface SeedPerson {
  firstName: string;
  lastName: string;
  website: string;
  startDate: string;
  skills: string[];
  attachments: FileCellData[];
}

const POOL_SIZE = 2000;
const FIELD_SALTS = {
  seed: 1,
  age: 2,
  salary: 3,
  department: 4,
  status: 5,
  isActive: 6,
  feedback: 7,
} as const;

let pool: SeedPerson[] | null = null;

export function generatePeople(count: number): Person[] {
  pool ??= Array.from({ length: POOL_SIZE }, (_, i) => generateSeedPerson(i));
  const seeds = pool;

  return Array.from({ length: count }, (_, index) => {
    const base = getItem(seeds, index);
    const other = pickItem(seeds, index, "seed");
    const { firstName } = base;
    const { lastName } = other;

    return {
      id: `person-${index}`,
      name: `${firstName} ${lastName}`,
      age: randomInt(index, "age", 22, 65),
      email: `${firstName}.${lastName}${index}@example.com`.toLowerCase(),
      website: other.website,
      feedback: pickItem(feedbackNotes, index, "feedback"),
      salary: randomInt(index, "salary", 40, 150) * 1000,
      department: pickItem(departments, index, "department"),
      status: pickItem(statuses, index, "status"),
      isActive: randomInt(index, "isActive", 0, 1) === 1,
      startDate: other.startDate,
      skills: base.skills,
      attachments: other.attachments,
    };
  });
}

const feedbackNotes = [
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
  `This employee has demonstrated exceptional growth over the past year. Starting as a junior developer, they quickly mastered our tech stack and began contributing to major features within their first month.

Key accomplishments include:
- Led the migration of our legacy authentication system to OAuth 2.0
- Reduced API response times by 40% through query optimization
- Mentored two interns who are now full-time employees
- Presented at three internal tech talks on React best practices

Areas for continued development:
- Public speaking skills for external conferences
- System design for distributed architectures
- Cross-team collaboration on larger initiatives

Overall, this is one of our strongest performers and a key contributor to team morale. Highly recommended for the senior engineer promotion track.`,
  `Performance Review Summary - Q4 2024

Strengths:
The employee consistently demonstrates strong problem-solving abilities and technical expertise. They have taken ownership of several critical projects and delivered them on time with high quality.

Growth Areas:
- Documentation could be more thorough
- Sometimes takes on too much work without delegating
- Could benefit from more proactive communication

Goals for Next Quarter:
1. Complete AWS Solutions Architect certification
2. Lead the new customer dashboard project
3. Improve test coverage to 85% on owned modules
4. Participate in at least two cross-functional initiatives

Manager Notes:
This team member is a valuable asset to the organization. Their dedication and work ethic serve as an example for others. We should ensure they have opportunities for advancement to retain this talent long-term.`,
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

function generateSeedPerson(id: number): SeedPerson {
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
      size: sizeKB * 1024,
      type: file.type,
      url: `https://example.com/files/${id}/${file.name}`,
    };
  });

  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    website: faker.internet.url().replace(/\/$/, ""),
    startDate:
      faker.date
        .between({ from: "2018-01-01", to: "2024-01-01" })
        .toISOString()
        .split("T")[0] ?? "",
    skills: faker.helpers.arrayElements(skills, { min: 1, max: 5 }),
    attachments,
  };
}

function getItem<T>(items: readonly T[], position: number): T {
  const item = items[position % items.length];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

function pickItem<T>(
  items: readonly T[],
  index: number,
  field: keyof typeof FIELD_SALTS,
): T {
  return getItem(items, getFieldHash(index, field));
}

function randomInt(
  index: number,
  field: keyof typeof FIELD_SALTS,
  min: number,
  max: number,
) {
  return min + (getFieldHash(index, field) % (max - min + 1));
}

function getFieldHash(index: number, field: keyof typeof FIELD_SALTS) {
  return hash(hash(index) + FIELD_SALTS[field]);
}

function hash(value: number) {
  let h = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
