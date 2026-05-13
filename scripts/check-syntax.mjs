import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function getTrackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

function checkJson(file) {
  const raw = readFileSync(file, "utf8");
  JSON.parse(raw);
}

function checkJs(file) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

function main() {
  const files = getTrackedFiles();

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const jsFiles = files.filter((f) => /\.(cjs|mjs|js)$/.test(f));

  const failures = [];

  for (const file of jsonFiles) {
    try {
      checkJson(file);
    } catch (error) {
      failures.push({ file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const file of jsFiles) {
    try {
      checkJs(file);
    } catch (error) {
      failures.push({ file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (failures.length > 0) {
    console.error("[check:syntax] Syntax validation failed:");
    for (const item of failures) {
      console.error(`- ${item.file}: ${item.error}`);
    }
    process.exit(1);
  }

  console.log(
    `[check:syntax] OK: checked ${jsonFiles.length} JSON and ${jsFiles.length} JS files in ${path.basename(process.cwd())}`,
  );
}

main();
