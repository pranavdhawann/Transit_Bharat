import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const FILES = [...walk("src"), ...walk("scripts")].filter((f) =>
  /\.(ts|tsx|mjs|css|svg)$/.test(f),
);

function offenders(re: RegExp): string[] {
  return FILES.filter((f) => re.test(readFileSync(f, "utf8")));
}

describe("product naming", () => {
  it("never uses the old product name", () => {
    expect(offenders(/Transit\s+Bharat|transit-bharat/i)).toEqual([]);
  });

  it("uses the bt: storage prefix, never tb:", () => {
    expect(offenders(/\btb:/)).toEqual([]);
  });

  it("uses the .bt-animate class, never .tb-animate", () => {
    expect(offenders(/tb-animate/)).toEqual([]);
  });
});
