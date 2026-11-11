import { spawnSync } from "node:child_process";
import path from "node:path";

const COMMENT_RULE =
  /\[\w+\/tablecn\((comment-style|no-low-value-comments)\)\]$/;

const input = JSON.parse(await new Response(process.stdin).text());
const filePath: unknown = input.tool_input?.file_path;

if (typeof filePath === "string" && /\.[cm]?[jt]sx?$/.test(filePath)) {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const { stdout } = spawnSync(
    path.join(root, "node_modules/.bin/oxlint"),
    ["--format=unix", filePath],
    { cwd: root, encoding: "utf8" },
  );
  const problems = stdout.split("\n").filter((line) => COMMENT_RULE.test(line));
  if (problems.length > 0) {
    console.error(
      `Comments in ${path.relative(root, filePath)} break the comment convention in AGENTS.md:\n${problems.join("\n")}`,
    );
    process.exit(2);
  }
}
