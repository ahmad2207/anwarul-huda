#!/usr/bin/env node
// Dumps the database with pg_dump and uploads the result to Supabase
// Storage, under a private "backups" bucket. Run locally with
// `pnpm db:backup`, or on a schedule via .github/workflows/backup.yml.
// See docs/BACKUPS.md for the restore procedure and the secrets this
// needs when it runs in CI rather than locally.
//
// Plain Node, not a Next.js module: this runs standalone, outside the
// app's own build, so it deliberately does not import lib/storage.ts
// (which assumes Next's module resolution) or anything else app side.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);
const BUCKET = "backups";

async function main() {
  const directUrl = process.env.DIRECT_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!directUrl) throw new Error("DIRECT_URL is not set.");
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must both be set.");
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "ahl-backup-"));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = path.join(tmpDir, `backup-${timestamp}.dump`);

  console.log("Running pg_dump...");
  // Custom format (-Fc): compressed, and the format pg_restore expects,
  // rather than a plain SQL file. --no-owner and --no-acl so restoring
  // into a different database (a different Supabase project, or a fresh
  // local one) never fails on a role that does not exist there.
  //
  // DIRECT_URL carries a "schema" query parameter, a Prisma connection
  // string convention, not a real libpq one: pg_dump refuses the URL
  // outright with that still on it. It is stripped off and passed as
  // pg_dump's own --schema flag instead.
  const url = new URL(directUrl);
  const schema = url.searchParams.get("schema");
  url.search = "";

  const args = ["--format=custom", "--no-owner", "--no-acl"];
  if (schema) {
    args.push("--schema", schema);
  }
  args.push("--file", dumpPath, url.toString());

  await execFileAsync("pg_dump", args);

  const bytes = await readFile(dumpPath);
  console.log(`Dump complete: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);

  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: existingBucket } = await client.storage.getBucket(BUCKET);
  if (!existingBucket) {
    const { error } = await client.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Could not create the backup bucket: ${error.message}`);
    }
  }

  const objectPath = `database/backup-${timestamp}.dump`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: "application/octet-stream",
  });
  if (uploadError) {
    throw new Error(`Could not upload the backup: ${uploadError.message}`);
  }

  console.log(`Uploaded: ${BUCKET}/${objectPath}`);

  await rm(tmpDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error("Backup failed:", error);
  process.exitCode = 1;
});
