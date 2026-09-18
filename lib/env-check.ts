// Fails loudly and by name when a required runtime environment variable
// is missing, rather than letting Auth.js's own generic Configuration
// error ("There was a problem with the server configuration") stand in
// for it. That message names nothing: diagnosing it meant reading
// Auth.js's own source to work out which variable it could even be.
// This check costs far less than that debugging did.
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "CRON_SECRET",
] as const;

export function assertRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. ` +
        "Set these in the Vercel project's environment variables (or .env locally) before this app can run.",
    );
  }
}
