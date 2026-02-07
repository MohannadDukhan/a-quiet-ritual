import { spawn, spawnSync } from "node:child_process";

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const port = process.env.PORT || "3000";
const host = "0.0.0.0";

const migrate = spawnSync(npxCmd, ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (migrate.status !== 0) {
  const code = migrate.status ?? 1;
  process.stderr.write(`Prisma migrate deploy failed with exit code ${code}.\n`);
  process.exit(code);
}

const server = spawn(npxCmd, ["next", "start", "-p", port, "-H", host], {
  stdio: "inherit",
  env: process.env,
});

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

server.on("error", (error) => {
  process.stderr.write(`Failed to start Next.js server: ${String(error)}\n`);
  process.exit(1);
});
