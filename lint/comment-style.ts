interface Comment {
  type: "Line" | "Block" | "Shebang";
  value: string;
  range: [number, number];
}

interface Fix {
  range: [number, number];
  text: string;
}

interface Context {
  filename: string;
  sourceCode: {
    text: string;
    getAllComments: () => Comment[];
  };
  report: (diagnostic: {
    node: Pick<Comment, "type" | "range">;
    message: string;
    fix?: () => Fix;
  }) => void;
}

interface Group {
  comments: Comment[];
  lines: string[];
}

const DIRECTIVE =
  /^[\s*]*(eslint|oxlint|oxfmt-|@ts-|@jsx|biome-|prettier-|istanbul|c8 |#region|#endregion|\/ <reference|@vitest-|[#@]__PURE__|webpack[A-Z]|turbopack[A-Z])/;
const TS_FILE = /\.[cm]?tsx?$/;
const DIVIDER = /^(?:[-=*#~_/+]{3,}.*|.*[-=*#~_]{3,})$/;
const TEST_STEP = /^(arrange|act|assert|given|when|then)\s*[:.]?$/i;
const TASK_MARKER = /\b(TODO|FIXME|XXX|HACK)\b/;
const TASK_LINK = /#\d+|https?:\/\//;
const BARE_ISSUE_REF = /(?<![\w/&#-])#[1-9]\d{2,4}(?![\w-])/;
const CODE_SPAN = /`[^`]*`/g;
const MAX_LINES = 4;
const LICENSE = /^!|@license|\bcopyright\b|\bSPDX-License-Identifier\b/i;
const JSDOC_TYPE = /^@(param|returns?|type|typedef)\s+\{/;
const EMPTY_JSDOC_TAG = /^@(param(\s+\[?[\w$.]+\]?)?|returns?)$/;
const CODE =
  /^((const|let|var)\s+[\w${}[\], ]+=.*;|import\s.+\sfrom\s+["'].+["'];?|(await\s+|return\s+)?[\w$.]+\(.*\);|[\w$.[\]]+\s*=\s*.+;|(if|for|while|switch)\s*\(.*\)\s*\{|\}(\s*else\s*\{)?|[{}]\)?;?)$/;
const FILLER =
  /^(Note|NOTE|Important|IMPORTANT|Basically|Simply|Just|Here we|Now we|This (function|helper|component|hook|method|file)|Helper (to|for|function))\b/;
const FIRST_PERSON = /\b(we|we're|we'll|our|us|let's|Let's|I|I'm)\b/;
const INDENTED_CODE = /^\s*\*\s{3,}\S/;
const END_PUNCTUATION = /([.?!:]|\.\.\.|https?:\/\/\S+|```)$/;
const DECLARATION =
  /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:static\s+)?(?:readonly\s+)?(?:(?:const|let|var|function\*?|class|interface|type|enum)\s+)?([A-Za-z_$][\w$]*)\s*[?!]?\s*[:=(<{]/;
const FILLER_WORDS = new Set(
  "a an the of for to in on at by with from and or is are be this that it its as get set return create new current value given whether".split(
    " ",
  ),
);

export const commentStyle = {
  meta: {
    type: "suggestion" as const,
    fixable: "code" as const,
    docs: {
      description:
        "Keeps comments to the comment convention: full sentences ending with a full stop, four lines at most, TODOs with a link, and no dividers, commented-out code, filler, first person, bare issue numbers or JSDoc types",
    },
  },
  create(context: Context) {
    return {
      "Program:exit"() {
        for (const group of getCommentGroups(context)) {
          checkGroup(context, group);
        }
      },
    };
  },
};

export const noLowValueComments = {
  meta: {
    type: "suggestion" as const,
    docs: {
      description:
        "Flags comments that only repeat the name of the declaration below them",
    },
  },
  create(context: Context) {
    return {
      "Program:exit"() {
        for (const { comments, lines } of getCommentGroups(context)) {
          const first = comments[0];
          const last = comments.at(-1);
          if (!first || !last || !restatesNextName(context, last, lines)) {
            continue;
          }
          context.report({
            node: { type: first.type, range: [first.range[0], last.range[1]] },
            message:
              "Drop the comment; it only repeats the name below it. Say why, or say nothing.",
          });
        }
      },
    };
  },
};

function getCommentGroups(context: Context) {
  const { text } = context.sourceCode;
  const groups: Group[] = [];
  let previous: Comment | undefined;
  for (const comment of context.sourceCode.getAllComments()) {
    if (comment.type === "Shebang") continue;
    const group = groups.at(-1);
    const continues =
      group &&
      comment.type === "Line" &&
      previous?.type === "Line" &&
      !isTrailing(text, previous) &&
      !isTrailing(text, comment) &&
      /^[ \t]*\n[ \t]*$/.test(text.slice(previous.range[1], comment.range[0]));
    if (continues) {
      group.comments.push(comment);
      group.lines.push(...getLines(comment));
    } else {
      groups.push({ comments: [comment], lines: getLines(comment) });
    }
    previous = comment;
  }
  return groups.filter(
    ({ comments, lines }) =>
      lines.length > 0 &&
      !comments.some((comment) => DIRECTIVE.test(comment.value)),
  );
}

function checkGroup(context: Context, { comments, lines }: Group) {
  const first = comments[0];
  const last = comments.at(-1);
  if (!first || !last) return;
  const text = comments.map((comment) => comment.value).join("\n");
  const isLine = first.type === "Line";
  const report = (message: string, fix?: () => Fix) =>
    context.report({
      node: { type: first.type, range: [first.range[0], last.range[1]] },
      message,
      fix,
    });

  if (lines.some((line) => DIVIDER.test(line))) {
    report("Drop the section divider; let the code's structure show it.");
    return;
  }
  if (isLine && lines.every((line) => CODE.test(line))) {
    report("Delete commented-out code; git keeps the history.");
    return;
  }
  if (isLine && lines.length === 1 && TEST_STEP.test(lines[0] ?? "")) {
    report("Drop the test step label.");
    return;
  }
  if (TASK_MARKER.test(text) && !TASK_LINK.test(text)) {
    report("Link the issue that tracks this, or drop the marker.");
  } else if (
    !TASK_MARKER.test(text) &&
    BARE_ISSUE_REF.test(text.replace(CODE_SPAN, ""))
  ) {
    report(
      "Drop the PR or issue number; git history records it. Keep the reason.",
    );
  }
  if (
    TS_FILE.test(context.filename) &&
    lines.some((line) => JSDOC_TYPE.test(line))
  ) {
    report("Drop the JSDoc type; TypeScript already has it.");
  }
  if (lines.some((line) => EMPTY_JSDOC_TAG.test(line))) {
    report("Drop the JSDoc tag that has no description.");
  }
  const isFileHeader =
    !isLine && !context.sourceCode.text.slice(0, first.range[0]).trim();
  if (lines.length > MAX_LINES && !isFileHeader && !LICENSE.test(text)) {
    report(
      `Cut this to ${MAX_LINES} lines or fewer: keep the constraint, drop the background.`,
    );
  }
  const filler = FILLER.exec(lines[0] ?? "")?.[0];
  if (filler) {
    report(`Drop the filler \`${filler}\` and say the reason directly.`);
  }
  if (lines.some((line) => FIRST_PERSON.test(line))) {
    report("Describe the code instead of `we`/`our`.");
  }
  const end = getSentenceEnd(last);
  if (end !== undefined) {
    report("End the comment with a full stop.", () => ({
      range: [end, end],
      text: ".",
    }));
  }
}

function getSentenceEnd(comment: Comment) {
  const start = comment.range[0] + 2;
  if (comment.type === "Line") {
    const content = comment.value.trimEnd();
    return !content.trim() || END_PUNCTUATION.test(content.trim())
      ? undefined
      : start + content.length;
  }
  let offset = 0;
  let end: number | undefined;
  let isSentence = false;
  for (const raw of comment.value.split("\n")) {
    const line = stripLine(raw);
    if (line.startsWith("@")) break;
    if (line) {
      isSentence = !INDENTED_CODE.test(raw) && !END_PUNCTUATION.test(line);
      end = start + offset + raw.trimEnd().length;
    }
    offset += raw.length + 1;
  }
  return isSentence ? end : undefined;
}

function restatesNextName(context: Context, comment: Comment, lines: string[]) {
  if (lines.some((line) => line.startsWith("@"))) return false;
  const { text } = context.sourceCode;
  if (isTrailing(text, comment)) return false;
  const lineEnd = text.indexOf("\n", comment.range[1]);
  if (lineEnd === -1) return false;
  const nextLineEnd = text.indexOf("\n", lineEnd + 1);
  const nextLine = text.slice(
    lineEnd + 1,
    nextLineEnd === -1 ? undefined : nextLineEnd,
  );
  const name = DECLARATION.exec(nextLine)?.[1];
  if (!name) return false;
  const content = getWords(lines.join(" "));
  if (content.length === 0 || content.length > 6) return false;
  const nameWords = new Set(
    getWords(
      name
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"),
    ),
  );
  return content.every((word) => nameWords.has(word));
}

function getWords(text: string) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((word) => !FILLER_WORDS.has(word))
    .map((word) => (word.length > 3 ? word.replace(/([^s])s$/, "$1") : word))
    .filter((word) => !FILLER_WORDS.has(word));
}

function getLines(comment: Comment) {
  return comment.value
    .split("\n")
    .map(stripLine)
    .filter((line) => line !== "");
}

function stripLine(line: string) {
  return line.replace(/^\s*\*?\s?/, "").trim();
}

function isTrailing(text: string, comment: Comment) {
  const lineStart = text.lastIndexOf("\n", comment.range[0] - 1) + 1;
  return text.slice(lineStart, comment.range[0]).trim() !== "";
}
