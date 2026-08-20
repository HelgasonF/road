import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const environment = { ...process.env };
const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL ?? "";
const localSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(supabaseUrl);

if (!environment.SUPABASE_SECRET_KEY && !environment.SUPABASE_SERVICE_ROLE_KEY && localSupabase) {
  const status = spawnSync("npx", ["supabase", "status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const secretKey = status.stdout.match(/^SECRET_KEY="([^"]+)"$/m)?.[1];
  if (secretKey) environment.SUPABASE_SECRET_KEY = secretKey;
}

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => next.kill(signal));
}

next.on("exit", (code) => {
  process.exit(code ?? 0);
});
