#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const stubPath = path.resolve(__dirname, "disable-sentry.cjs");
const convexPackageJson = require.resolve("convex/package.json");
const cliEntrypoint = path.resolve(convexPackageJson, "../bin/main.js");
const extraArgs = process.argv.slice(2);

const child = spawn(
  process.execPath,
  ["--require", stubPath, cliEntrypoint, "dev", ...extraArgs],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exit(code);
  }
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(0);
  }
});
