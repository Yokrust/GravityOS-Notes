import { cp, rm } from "node:fs/promises";

export async function resetDemoProject(options: {
  sourcePath: string;
  targetPath: string;
}): Promise<void> {
  await rm(options.targetPath, { force: true, recursive: true });
  await cp(options.sourcePath, options.targetPath, { recursive: true });
}
