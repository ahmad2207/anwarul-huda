import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Placeholder file storage, local disk only. CLAUDE.md's stack names
// Supabase Storage for this, but it is not wired up anywhere in this
// codebase yet (no client, no bucket, no credentials), and adding one is
// a real integration, not something to bring in silently as a side
// effect of one form field. This keeps evidence files working for now,
// under a gitignored directory, with the same evidencePath the schema
// already expects, so swapping in real object storage later only means
// changing this one function, not the schema or the calling code.
const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function saveUploadedFile(file: File, subdir: string): Promise<string> {
  const dir = path.join(STORAGE_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  return path.posix.join(subdir, fileName);
}
