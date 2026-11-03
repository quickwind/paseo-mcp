import { readFile } from "node:fs/promises";

/**
 * Strips `//` and `/* *\/` comments plus trailing commas so JSONC config files
 * (such as OpenCode's `opencode.jsonc`) can be parsed with `JSON.parse`.
 * String contents are preserved verbatim.
 */
export function stripJsonc(input: string): string {
  let out = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const next = input[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      } else if (ch === "\n") {
        out += ch;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === "\\") {
        const escaped = input[i + 1];
        if (escaped !== undefined) {
          out += escaped;
          i++;
        }
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    out += ch;
  }

  return removeTrailingCommas(out);
}

function removeTrailingCommas(input: string): string {
  let out = "";
  let inString = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (inString) {
      out += ch;
      if (ch === "\\") {
        const escaped = input[i + 1];
        if (escaped !== undefined) {
          out += escaped;
          i++;
        }
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j]!)) j++;
      if (input[j] === "}" || input[j] === "]") continue;
      out += ch;
      continue;
    }

    out += ch;
  }

  return out;
}

export function parseJsonc<T = Record<string, unknown>>(text: string): T | null {
  try {
    const parsed = JSON.parse(stripJsonc(text));
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export async function readJsoncFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return parseJsonc(content);
  } catch {
    return null;
  }
}
