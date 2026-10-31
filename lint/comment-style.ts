interface Comment {
  type: "Line" | "Block" | "Shebang";
  value: string;
  range: [number, number];
}

interface Context {
  sourceCode: {
    text: string;
    getAllComments: () => Comment[];
  };
  report: (diagnostic: {
    node: Pick<Comment, "type" | "range">;
    message: string;
    fix?: () => { range: [number, number]; text: string };
  }) => void;
}

const DIRECTIVE =
  /^\s*(eslint|oxlint|@ts-|biome-|prettier-|istanbul|c8 |#region|#endregion|\/ <reference|@vitest-)/;
const IMPERATIVE =
  /^(Add|Allow|Append|Apply|Attach|Build|Calculate|Call|Cancel|Capture|Check|Clear|Close|Collect|Compare|Compensate|Compute|Convert|Copy|Count|Create|Delete|Determine|Disable|Dispatch|Emit|Enable|Ensure|Exclude|Extract|Fetch|Filter|Find|Flush|Force|Format|Generate|Get|Handle|Hide|Initialize|Insert|Iterate|Keep|Load|Loop|Make|Mark|Measure|Merge|Move|Normalize|Notify|Open|Parse|Prevent|Process|Push|Read|Register|Remove|Render|Replace|Reset|Restore|Return|Run|Save|Schedule|Scroll|Select|Set|Show|Simulate|Skip|Sort|Start|Stop|Store|Subscribe|Sync|Toggle|Track|Trigger|Try|Unsubscribe|Update|Use|Validate|Wait|Wrap|Write) [a-z`]/;
const FILLER =
  /^(Note|NOTE|Important|IMPORTANT|Basically|Simply|Just|Here we|Now we|This (function|helper|component|hook|method|file)|Helper (to|for|function))\b/;
const FIRST_PERSON = /\b(we|we're|we'll|our|us|let's|Let's|I|I'm)\b/;
const BANNER = /^\s*([-=*#~_/])\1{3,}|([-=*#~_])\2{3,}\s*$/;
const CODE =
  /^(const|let|var|return|await|import|export|if|for|while)\b.*[;{]$|^[\w$.]+\([^)]*\);$|^[\w$.]+ = .+;$|^[{}]\)?;?$/;
const ABBREVIATION = /\b(e\.g|i\.e|etc|vs)\.$/;

export const commentStyle = {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Keeps `//` comments to short reasons: no narrating what the next line does, no trailing period, filler, first person, banners or commented-out code",
    },
  },
  create(context: Context) {
    return {
      "Program:exit"() {
        for (const block of getLineCommentBlocks(context)) {
          checkBlock(context, block);
        }
      },
    };
  },
};

function getLineCommentBlocks(context: Context) {
  const { text } = context.sourceCode;
  const blocks: Comment[][] = [];
  let previous: Comment | undefined;
  for (const comment of context.sourceCode.getAllComments()) {
    if (comment.type !== "Line") {
      previous = undefined;
      continue;
    }
    const between = previous && text.slice(previous.range[1], comment.range[0]);
    const block = blocks.at(-1);
    // Lines right under each other read as one comment
    if (block && between !== undefined && /^[ \t]*\n[ \t]*$/.test(between)) {
      block.push(comment);
    } else {
      blocks.push([comment]);
    }
    previous = comment;
  }
  return blocks.filter((block) => !DIRECTIVE.test(block[0]?.value ?? ""));
}

function checkBlock(context: Context, block: Comment[]) {
  const first = block[0];
  const last = block.at(-1);
  if (!first || !last) return;
  const lines = block.map((comment) => comment.value.trim());
  const opening = lines[0] ?? "";
  const closing = lines.at(-1) ?? "";
  const report = (
    message: string,
    fix?: () => { range: [number, number]; text: string },
  ) =>
    context.report({
      node: { type: "Line", range: [first.range[0], last.range[1]] },
      message,
      fix,
    });

  if (lines.some((line) => BANNER.test(line))) {
    report("Drop banner comments; let the code's structure show the sections.");
    return;
  }
  if (lines.every((line) => CODE.test(line))) {
    report("Delete commented-out code; git keeps the history.");
    return;
  }
  const filler = FILLER.exec(opening)?.[0];
  if (filler) {
    report(`Drop the filler \`${filler}\` and say the reason directly.`);
  }
  if (IMPERATIVE.test(opening)) {
    report(
      "Say why, not what the next line does: `Keeps …` rather than `Keep …`, or drop it if the code says it already.",
    );
  }
  if (lines.some((line) => FIRST_PERSON.test(line))) {
    report("Describe the code instead of `we`/`our`.");
  }
  const isOneSentence = !/[.!?]\s/.test(lines.join(" "));
  if (isOneSentence && /[^.]\.$/.test(closing) && !ABBREVIATION.test(closing)) {
    report("Drop the trailing period from a one-sentence comment.", () => ({
      range: [last.range[1] - 1, last.range[1]],
      text: "",
    }));
  }
}
