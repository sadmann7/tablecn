import type * as React from "react";

import { cn } from "cn";

const TAGLINE =
  "A shadcn/ui data table with sorting, filtering, and pagination.";
const WORDMARK = "tablecn";

const INSTALL_COMMAND = "pnpm dlx shadcn@latest add @diceui/data-table";

export function DataTableLaunchBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="launch-glow launch-glow-primary absolute top-[-30%] right-[-10%] h-[90%] w-[70%] rounded-full" />
      <div className="launch-glow launch-glow-secondary absolute bottom-[-20%] left-[-5%] h-[75%] w-[55%] rounded-full" />
      <div className="launch-vignette absolute inset-0" />
      <div className="launch-grain absolute inset-0" />
    </div>
  );
}

export function DataTableLaunchIntroScene() {
  return (
    <div className="launch-intro absolute inset-0 flex flex-col items-center justify-center gap-14 text-center">
      <DataTableLaunchLogo />
      <DataTableLaunchWords
        text={TAGLINE}
        delay={620}
        className="block max-w-280 text-6xl leading-tight font-medium tracking-tight text-balance text-white/70"
      />
    </div>
  );
}

interface DataTableLaunchStoryProps {
  eyebrow: string;
  title: string;
  description: string;
  code: string[];
  highlightedLines: number[];
  children?: React.ReactNode;
}

export function DataTableLaunchStory({
  eyebrow,
  title,
  description,
  code,
  highlightedLines,
  children,
}: DataTableLaunchStoryProps) {
  return (
    <>
      <div className="launch-story absolute inset-y-0 left-30 flex w-130 flex-col justify-center gap-8">
        <span className="launch-rise flex items-center gap-3 font-mono text-xl text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0.75rem_rgb(52_211_153)]" />
          {eyebrow}
        </span>
        <h2 className="text-7xl leading-[1.05] font-semibold tracking-tight text-balance text-white">
          <DataTableLaunchWords text={title} delay={60} />
        </h2>
        <p
          className="launch-rise text-[1.75rem] leading-snug text-pretty text-white/50"
          style={launchDelay(220)}
        >
          {description}
        </p>
        <pre className="launch-code relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/4 py-5 font-mono text-[1.1875rem] leading-9 text-white/60 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
          {code.map((line, index) => (
            <code
              key={`line-${index}`}
              data-highlighted={highlightedLines.includes(index)}
              className="launch-line border-l-2 border-transparent px-6 transition-colors duration-300 data-[highlighted=true]:border-emerald-400 data-[highlighted=true]:bg-emerald-400/10 data-[highlighted=true]:text-white"
              style={launchDelay(260 + index * 45)}
            >
              <CodeLine line={line} />
            </code>
          ))}
        </pre>
        {children}
      </div>
      <div className="launch-lower-third absolute bottom-16 left-16 flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/55 px-8 py-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md">
        <span className="flex items-center gap-3 font-mono text-lg text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0.75rem_rgb(52_211_153)]" />
          {eyebrow}
        </span>
        <span className="text-4xl font-semibold tracking-tight text-white">
          {title}
        </span>
      </div>
    </>
  );
}

interface DataTableLaunchVariantsProps {
  variants: string[];
  activeCount: number;
}

export function DataTableLaunchVariants({
  variants,
  activeCount,
}: DataTableLaunchVariantsProps) {
  return (
    <div
      className="launch-rise flex flex-wrap gap-2 font-mono text-lg"
      style={launchDelay(420)}
    >
      {variants.map((variant, index) => (
        <span
          key={variant}
          data-active={index < activeCount}
          className="rounded-lg border border-white/10 px-3 py-1 text-white/50 transition-[color,background-color,border-color,scale] duration-300 data-[active=true]:scale-105 data-[active=true]:border-emerald-400/40 data-[active=true]:bg-emerald-400/10 data-[active=true]:text-emerald-300"
        >
          {variant}
        </span>
      ))}
    </div>
  );
}

interface DataTableLaunchKeystrokeProps {
  keys: string[];
}

export function DataTableLaunchKeystroke({
  keys,
}: DataTableLaunchKeystrokeProps) {
  return (
    <div className="launch-keystroke absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-3">
      {keys.map((key, index) => (
        <kbd
          key={key}
          className="launch-key flex h-18 min-w-18 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 font-sans text-4xl text-white shadow-[0_6px_0_rgb(255_255_255/0.08)] backdrop-blur-md"
          style={launchDelay(index * 60)}
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

export function DataTableLaunchOutroScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-14">
      <DataTableLaunchLogo size="md" delay={120} />
      <div
        className="launch-rise flex items-center gap-5 rounded-2xl border border-white/10 bg-white/4 px-8 py-5 font-mono text-[1.75rem] text-white/85 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.8)]"
        style={launchDelay(520)}
      >
        <span className="text-emerald-300">$</span>
        <span>{INSTALL_COMMAND}</span>
      </div>
      <span
        className="launch-rise font-mono text-3xl tracking-wide text-white/55"
        style={launchDelay(760)}
      >
        tablecn.com
      </span>
    </div>
  );
}

interface DataTableLaunchLogoProps {
  size?: "lg" | "md";
  delay?: number;
}

function DataTableLaunchLogo({
  size = "lg",
  delay = 0,
}: DataTableLaunchLogoProps) {
  return (
    <div
      className={cn(
        "flex items-center text-white",
        size === "lg" ? "gap-8" : "gap-6",
      )}
      role="img"
      aria-label={WORDMARK}
    >
      <div
        aria-hidden="true"
        className={cn(
          "grid grid-cols-2",
          size === "lg" ? "size-26 gap-2.5" : "size-20 gap-2",
        )}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="launch-pop rounded-[22%] border-[0.4rem] border-white"
            style={launchDelay(delay + index * 70)}
          />
        ))}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "flex leading-none font-semibold tracking-tighter",
          size === "lg" ? "text-[9rem]" : "text-[7rem]",
        )}
      >
        {WORDMARK.split("").map((letter, index) => (
          <span
            key={`${index}-${letter}`}
            className="launch-letter"
            style={launchDelay(delay + 180 + index * 35)}
          >
            {letter}
          </span>
        ))}
      </span>
    </div>
  );
}

function launchDelay(ms: number) {
  return { "--launch-delay": `${ms}ms` } as React.CSSProperties;
}

interface DataTableLaunchWordsProps {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
}

function DataTableLaunchWords({
  text,
  delay = 0,
  stagger = 55,
  className,
}: DataTableLaunchWordsProps) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {text.split(" ").map((word, index) => (
        <span
          key={`${index}-${word}`}
          aria-hidden="true"
          className="launch-word"
          style={launchDelay(delay + index * stagger)}
        >
          {word}
          {" "}
        </span>
      ))}
    </span>
  );
}

interface CodeLineProps {
  line: string;
}

function CodeLine({ line }: CodeLineProps) {
  if (!line) return " ";

  return line.split(/("[^"]*"|\/\/.*$|<\/?[A-Za-z]+)/).map((part, index) => (
    <span key={`${index}-${part}`} className={getTokenClassName(part)}>
      {part}
    </span>
  ));
}

function getTokenClassName(token: string) {
  if (token.startsWith('"')) return "text-emerald-300";
  if (token.startsWith("//")) return "text-white/50";
  if (token.startsWith("<")) return "text-sky-300";
  return undefined;
}
