import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const host = "0.0.0.0";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const child = spawn(npxCmd, ["next", "start", "-p", port, "-H", host], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  process.stderr.write(`Failed to start Next.js server: ${String(error)}\n`);
  process.exit(1);
});
