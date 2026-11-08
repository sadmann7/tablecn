import * as chrono from "chrono-node";

import type { Task } from "@/db/schema";

export const TIME_ZONE_COOKIE = "tz";

export interface TaskSearch {
  text: string;
  dateRange: [string, string] | null;
}

export function parseTaskSearch(
  value: string,
  timeZone: string,
  now = new Date(),
): TaskSearch {
  const [result] = chrono.parse(value, {
    instant: now,
    timezone: getTimeZoneOffset(timeZone, now),
  });
  if (!result) return { text: value, dateRange: null };

  const text =
    `${value.slice(0, result.index)}${value.slice(result.index + result.text.length)}`
      .replace(/\s+/g, " ")
      .trim();

  return {
    text,
    dateRange: [
      getComponentsDay(result.start),
      getComponentsDay(result.end ?? result.start),
    ],
  };
}

export function matchesTaskSearch(
  task: Task,
  search: TaskSearch,
  timeZone: string,
) {
  if (search.dateRange) {
    const day = getDay(task.createdAt, timeZone);
    if (day < search.dateRange[0] || day > search.dateRange[1]) return false;
  }
  if (!search.text) return true;

  const text = search.text.toLowerCase();
  return [
    task.code,
    task.title,
    task.status,
    task.priority,
    task.label,
    String(task.estimatedHours),
  ].some((value) => value?.toLowerCase().includes(text));
}

export function getValidTimeZone(timeZone: string | undefined) {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

function getDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getComponentsDay(components: chrono.ParsedComponents) {
  const year = components.get("year") ?? 0;
  const month = String(components.get("month") ?? 1).padStart(2, "0");
  const day = String(components.get("day") ?? 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTimeZoneOffset(timeZone: string, date: Date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}
