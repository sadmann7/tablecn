import type * as React from "react";

import { LayoutGrid } from "lucide-react";

const TAGLINE =
  "A shadcn/ui data table with sorting, filtering, and pagination.";

const INSTALL_COMMAND = "pnpm dlx shadcn@latest add @diceui/data-table";

export function LaunchBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="launch-glow launch-glow-primary absolute top-[-30%] right-[-10%] h-[90%] w-[70%] rounded-full" />
      <div className="launch-glow launch-glow-secondary absolute bottom-[-20%] left-[-5%] h-[75%] w-[55%] rounded-full" />
      <div className="launch-vignette absolute inset-0" />
      <div className="launch-grain absolute inset-0" />
    </div>
  );
}

export function LaunchIntroScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 text-center">
      <div className="launch-logo flex items-center gap-6 text-white">
        <LayoutGrid className="size-24" strokeWidth={1.5} />
        <span className="text-[8.5rem] leading-none font-semibold tracking-tighter">
          tablecn
        </span>
      </div>
      <p
        className="launch-rise max-w-280 text-5xl leading-snug text-balance text-white/60"
        style={launchDelay(60)}
      >
        {TAGLINE}
      </p>
    </div>
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
    <div className="absolute inset-y-0 left-30 flex w-130 flex-col justify-center gap-8">
      <span className="launch-rise font-mono text-xl text-emerald-300">
        {eyebrow}
      </span>
      <h2
        className="launch-rise text-7xl leading-[1.05] font-semibold tracking-tight text-balance text-white"
        style={launchDelay(40)}
      >
        {title}
      </h2>
      <p
        className="launch-rise text-[1.75rem] leading-snug text-pretty text-white/50"
        style={launchDelay(80)}
      >
        {description}
      </p>
      <pre
        className="launch-rise flex flex-col rounded-2xl border border-white/10 bg-white/4 py-5 font-mono text-[1.1875rem] leading-9 text-white/60"
        style={launchDelay(120)}
      >
        {code.map((line, index) => (
          <code
            key={`${index}-${line}`}
            data-highlighted={highlightedLines.includes(index)}
            className="border-l-2 border-transparent px-6 transition-colors duration-300 data-[highlighted=true]:border-emerald-400 data-[highlighted=true]:bg-emerald-400/10 data-[highlighted=true]:text-white"
          >
            <CodeLine line={line} />
          </code>
        ))}
      </pre>
      {children}
    </div>
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
      style={launchDelay(160)}
    >
      {variants.map((variant, index) => (
        <span
          key={variant}
          data-active={index < activeCount}
          className="rounded-lg border border-white/10 px-3 py-1 text-white/30 transition-colors duration-300 data-[active=true]:border-emerald-400/40 data-[active=true]:bg-emerald-400/10 data-[active=true]:text-emerald-300"
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
      {keys.map((key) => (
        <kbd
          key={key}
          className="flex h-18 min-w-18 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 font-sans text-4xl text-white shadow-[0_6px_0_rgb(255_255_255/0.08)] backdrop-blur-md"
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

export function LaunchOutroScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12">
      <div className="launch-logo flex items-center gap-6 text-white">
        <LayoutGrid className="size-24" strokeWidth={1.5} />
        <span className="text-[8rem] leading-none font-semibold tracking-tighter">
          tablecn
        </span>
      </div>
      <div
        className="launch-rise flex items-center gap-5 rounded-2xl border border-white/10 bg-white/4 px-8 py-5 font-mono text-2xl text-white/80"
        style={launchDelay(80)}
      >
        <span className="text-white/35">$</span>
        {INSTALL_COMMAND}
      </div>
      <span
        className="launch-rise font-mono text-2xl text-white/45"
        style={launchDelay(140)}
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
