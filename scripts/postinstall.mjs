import { execSync } from "node:child_process";

const skip = String(process.env.ACTIO_SKIP_ELECTRON_REBUILD || "").trim() === "1";

if (skip) {
  // eslint-disable-next-line no-console
  console.log("postinstall: skip electron rebuild (ACTIO_SKIP_ELECTRON_REBUILD=1)");
  process.exit(0);
}

execSync("electron-builder install-app-deps", { stdio: "inherit" });
