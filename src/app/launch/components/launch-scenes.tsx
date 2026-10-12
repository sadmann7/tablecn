import type * as React from "react";

const TAGLINE = "The data table for shadcn/ui.";
const FEATURES = ["Sorting", "Filtering", "Pagination", "URL state"];
const WORDMARK = "tablecn";

const INSTALL_COMMAND = "pnpm dlx shadcn@latest add @diceui/data-table";

export function LaunchBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="launch-dots absolute -inset-20" />
      <div className="launch-glow launch-glow-primary absolute top-[-30%] right-[-10%] h-[90%] w-[70%] rounded-full" />
      <div className="launch-glow launch-glow-secondary absolute bottom-[-20%] left-[-5%] h-[75%] w-[55%] rounded-full" />
      <div className="launch-vignette absolute inset-0" />
      <div className="launch-grain absolute inset-0" />
    </div>
  );
}

interface LaunchLogoProps {
  size?: "lg" | "md";
  delay?: number;
}

function LaunchLogo({ size = "lg", delay = 0 }: LaunchLogoProps) {
  return (
    <div
      className={
        size === "lg"
          ? "flex items-center gap-8 text-white"
          : "flex items-center gap-6 text-white"
      }
      aria-label={WORDMARK}
    >
      <div
        aria-hidden="true"
        className={
          size === "lg"
            ? "grid size-26 grid-cols-2 gap-2.5"
            : "grid size-20 grid-cols-2 gap-2"
        }
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
        className={
          size === "lg"
            ? "flex text-[9rem] leading-none font-semibold tracking-tighter"
            : "flex text-[7rem] leading-none font-semibold tracking-tighter"
        }
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

export function LaunchIntroScene() {
  return (
    <div className="launch-intro absolute inset-0 flex flex-col items-center justify-center gap-14 text-center">
      <LaunchLogo />
      <LaunchWords
        text={TAGLINE}
        delay={620}
        className="text-6xl leading-tight font-medium tracking-tight text-white/70"
      />
      <div className="flex items-center gap-3">
        {FEATURES.map((feature, index) => (
          <span
            key={feature}
            className="launch-rise rounded-full border border-white/12 bg-white/5 px-6 py-2.5 font-mono text-2xl text-white/60"
            style={launchDelay(1100 + index * 110)}
          >
            {feature}
          </span>
        ))}
      </div>
    </div>
  );
}

interface LaunchWordsProps {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
}

/** Reveals a line one word at a time, the way launch videos set their headlines. */
function LaunchWords({
  text,
  delay = 0,
  stagger = 55,
  className,
}: LaunchWordsProps) {
  return (
    <span className={className} aria-label={text}>
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

interface LaunchStoryProps {
  eyebrow: string;
  title: string;
  description: string;
  code: string[];
  highlightedLines: number[];
  children?: React.ReactNode;
}

export function LaunchStory({
  eyebrow,
  title,
  description,
  code,
  highlightedLines,
  children,
}: LaunchStoryProps) {
  return (
    <>
      <div className="launch-story absolute inset-y-0 left-30 flex w-130 flex-col justify-center gap-8">
        <span className="launch-rise flex items-center gap-3 font-mono text-xl text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0.75rem_rgb(52_211_153)]" />
          {eyebrow}
        </span>
        <h2 className="text-7xl leading-[1.05] font-semibold tracking-tight text-balance text-white">
          <LaunchWords text={title} delay={60} />
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
              // Keyed by position, so a line whose text changes updates in place instead of replaying its reveal
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
      <div className="launch-lower-third absolute bottom-16 left-16 flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/55 px-8 py-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl">
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

interface LaunchVariantsProps {
  variants: string[];
  activeCount: number;
}

export function LaunchVariants({ variants, activeCount }: LaunchVariantsProps) {
  return (
    <div
      className="launch-rise flex flex-wrap gap-2 font-mono text-lg"
      style={launchDelay(420)}
    >
      {variants.map((variant, index) => (
        <span
          key={variant}
          data-active={index < activeCount}
          className="rounded-lg border border-white/10 px-3 py-1 text-white/30 transition-[color,background-color,border-color,scale] duration-300 data-[active=true]:scale-105 data-[active=true]:border-emerald-400/40 data-[active=true]:bg-emerald-400/10 data-[active=true]:text-emerald-300"
        >
          {variant}
        </span>
      ))}
    </div>
  );
}

interface LaunchKeystrokeProps {
  keys: string[];
}

export function LaunchKeystroke({ keys }: LaunchKeystrokeProps) {
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

export function LaunchOutroScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-14">
      <LaunchLogo size="md" delay={120} />
      <div
        className="launch-rise flex items-center gap-5 rounded-2xl border border-white/10 bg-white/4 px-8 py-5 font-mono text-[1.75rem] text-white/85 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.8)]"
        style={launchDelay(520)}
      >
        <span className="text-emerald-300">$</span>
        {/* The hidden copy holds the box at its final width while the command types out */}
        <span className="relative">
          <span className="invisible pe-[0.6ch]">{INSTALL_COMMAND}</span>
          <span
            className="launch-typed absolute inset-y-0 left-0 border-r-[0.6ch] border-emerald-300"
            style={
              {
                "--launch-chars": INSTALL_COMMAND.length,
                ...launchDelay(760),
              } as React.CSSProperties
            }
          >
            {INSTALL_COMMAND}
          </span>
        </span>
      </div>
      <span
        className="launch-rise font-mono text-3xl tracking-wide text-white/55"
        style={launchDelay(2300)}
      >
        tablecn.com
      </span>
    </div>
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
  if (token.startsWith("//")) return "text-white/30";
  if (token.startsWith("<")) return "text-sky-300";
  return undefined;
}

function launchDelay(ms: number) {
  return { "--launch-delay": `${ms}ms` } as React.CSSProperties;
}
