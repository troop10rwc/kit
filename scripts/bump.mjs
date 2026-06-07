// Lockstep version bump for the kit. pnpm has no native recursive `version`,
// so we bump all package.json files (root + every workspace) to one shared
// version, commit, and tag v<version>. The release.yml workflow publishes on
// that tag. `pnpm publish` rewrites the `workspace:^` dep in worker-kit to the
// real version at publish time, so dependency ranges need no hand-editing.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const bump = process.argv[2];
if (!["patch", "minor", "major"].includes(bump)) {
  console.error("usage: node scripts/bump.mjs <patch|minor|major>");
  process.exit(1);
}

const files = [
  "package.json",
  "packages/shared/package.json",
  "packages/ui/package.json",
  "packages/worker-kit/package.json",
];

const [maj, min, pat] = JSON.parse(readFileSync("package.json", "utf8"))
  .version.split(".")
  .map(Number);
const next =
  bump === "major"
    ? `${maj + 1}.0.0`
    : bump === "minor"
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${pat + 1}`;

for (const f of files) {
  const pkg = JSON.parse(readFileSync(f, "utf8"));
  pkg.version = next;
  writeFileSync(f, JSON.stringify(pkg, null, 2) + "\n");
}

execSync(`git add ${files.join(" ")}`, { stdio: "inherit" });
execSync(`git commit -m "release v${next}"`, { stdio: "inherit" });
// Annotated (-a) so `git push --follow-tags` actually pushes it — lightweight
// tags are skipped by --follow-tags and the release would never fire.
execSync(`git tag -a v${next} -m "release v${next}"`, { stdio: "inherit" });
console.log(`\nbumped all packages to v${next} (lockstep) and tagged.`);
