const { spawnSync } = require("child_process");

const includeFrontend = process.argv.includes("--all");

const commands = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["test"]],
  ["node", ["scripts/validate-sample-repos.js"]],
  ["npm", ["run", "build"]],
];

if (includeFrontend) {
  commands.push(["npm", ["run", "frontend:build"]]);
}

for (const [command, args] of commands) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
