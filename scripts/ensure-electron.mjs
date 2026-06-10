import { execFile, execFileSync } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const appRequire = createRequire(path.resolve("apps/desktop/package.json"));
const electronPackagePath = appRequire.resolve("electron/package.json");
const electronDirectory = path.dirname(electronPackagePath);
const electronRequire = createRequire(electronPackagePath);
const electronPackage = JSON.parse(await readFile(electronPackagePath, "utf8"));
const executablePath = getExecutablePath();
const installedExecutable = path.join(
  electronDirectory,
  "dist",
  executablePath
);

if (await exists(installedExecutable)) {
  await writeFile(
    path.join(electronDirectory, "path.txt"),
    executablePath,
    "utf8"
  );
  process.exit(0);
}

const { downloadArtifact } = electronRequire("@electron/get");
const archivePath = await downloadArtifact({
  arch: getArchitecture(),
  artifactName: "electron",
  checksums: electronRequire("./checksums.json"),
  platform: process.env.npm_config_platform || process.platform,
  version: electronPackage.version
});
const distDirectory = path.join(electronDirectory, "dist");

await rm(distDirectory, { force: true, recursive: true });
await mkdir(distDirectory, { recursive: true });
await extractArchive(archivePath, distDirectory);

const bundledTypes = path.join(distDirectory, "electron.d.ts");
if (await exists(bundledTypes)) {
  await rename(bundledTypes, path.join(electronDirectory, "electron.d.ts"));
}

if (!(await exists(installedExecutable))) {
  throw new Error(
    `Electron executable was not extracted: ${installedExecutable}`
  );
}

await writeFile(
  path.join(electronDirectory, "path.txt"),
  executablePath,
  "utf8"
);

async function extractArchive(archivePath, destinationPath) {
  if (process.platform === "win32") {
    const escapedArchive = archivePath.replaceAll("'", "''");
    const escapedDestination = destinationPath.replaceAll("'", "''");
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedDestination}' -Force`
    ]);
    return;
  }

  await execFileAsync("unzip", [
    "-q",
    "-o",
    archivePath,
    "-d",
    destinationPath
  ]);
}

function getArchitecture() {
  const configuredArchitecture = process.env.npm_config_arch;
  if (
    process.platform === "darwin" &&
    !configuredArchitecture &&
    process.arch === "x64"
  ) {
    try {
      const translated = execFileSync("sysctl", [
        "-in",
        "sysctl.proc_translated"
      ])
        .toString()
        .trim();
      if (translated === "1") {
        return "arm64";
      }
    } catch {
      // Fall back to the architecture reported by Node.
    }
  }

  return configuredArchitecture || process.arch;
}

function getExecutablePath() {
  const platform = process.env.npm_config_platform || process.platform;
  switch (platform) {
    case "darwin":
    case "mas":
      return "Electron.app/Contents/MacOS/Electron";
    case "freebsd":
    case "linux":
    case "openbsd":
      return "electron";
    case "win32":
      return "electron.exe";
    default:
      throw new Error(`Electron is not available for platform: ${platform}`);
  }
}

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
