import { stat } from "node:fs/promises";
import path from "node:path";

/**
 * Walks up from cwd looking for a `.git` entry. Matches a file as well as a
 * directory so worktrees and submodules resolve. Stops at the filesystem root.
 */
export async function findRepoRoot(cwd: string): Promise<string | null> {
  let current = path.resolve(cwd);
  for (;;) {
    try {
      await stat(path.join(current, ".git"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

/**
 * Every directory from cwd up to the repository root, cwd first.
 */
export async function dirsUpToRepoRoot(cwd: string): Promise<string[]> {
  const start = path.resolve(cwd);
  const repoRoot = await findRepoRoot(start);
  if (!repoRoot || repoRoot === start) return [start];

  const dirs = [start];
  let current = start;
  while (current !== repoRoot) {
    const parent = path.dirname(current);
    if (parent === current) break;
    dirs.push(parent);
    current = parent;
  }
  return dirs;
}
