// Extract the release-notes section for one version from CHANGELOG.md.
// Prints the section body (without the `## vX.Y.Z` heading) to stdout so the
// release workflow can pass it to `gh release create --notes-file`. The
// committed CHANGELOG.md is the reviewed source of truth; nothing is
// regenerated from commit messages here.
//
// Usage: node scripts/extract-changelog.mjs <vX.Y.Z>
import { readFileSync } from "node:fs";

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(`Usage: node scripts/extract-changelog.mjs <vX.Y.Z> (got: ${tag})`);
  process.exit(1);
}

const lines = readFileSync("CHANGELOG.md", "utf8").split("\n");
const start = lines.findIndex(
  (line) => line === `## ${tag}` || line.startsWith(`## ${tag} `),
);
if (start === -1) {
  console.error(
    `No "## ${tag}" section in CHANGELOG.md. Run \`cargo make changelog ${tag}\`, review, and commit it before tagging.`,
  );
  process.exit(1);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith("## ")) {
    end = i;
    break;
  }
}

const section = lines
  .slice(start + 1, end)
  .join("\n")
  .trim();
if (!section) {
  console.error(`Section "## ${tag}" in CHANGELOG.md is empty.`);
  process.exit(1);
}
process.stdout.write(`${section}\n`);
