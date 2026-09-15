import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Real object storage, on Supabase Storage as CLAUDE.md's stack names.
// Replaces the local disk placeholder that stood in for this from Phase
// 4 onward, back when no Supabase project existed yet. Everything in
// this file runs server side only: the secret key must never reach the
// browser.

const BUCKET = "uploads";

let cachedClient: ReturnType<typeof createClient> | null = null;
let bucketEnsured = false;

function getClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  cachedClient = createClient(url, secretKey, { auth: { persistSession: false } });
  return cachedClient;
}

/**
 * Creates the private bucket the first time it is needed, rather than
 * requiring it to already exist in the dashboard. Private: no public
 * bucket, a file is only reachable through a signed URL.
 */
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const client = getClient();

  const { data: existing } = await client.storage.getBucket(BUCKET);
  if (!existing) {
    const { error } = await client.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Could not create the storage bucket: ${error.message}`);
    }
  }
  bucketEnsured = true;
}

/**
 * Uploads a file under a subdirectory (for example "disbursement-evidence"
 * or "content/audio"), with a random name so two members' uploads never
 * collide. Returns the object's path within the bucket, which is what
 * gets stored on the record (evidencePath, filePath, coverPath), the same
 * way the local disk placeholder stored a relative path.
 */
export async function uploadFile(file: File, subdir: string): Promise<string> {
  await ensureBucket();
  const client = getClient();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${subdir}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    throw new Error(`Could not upload file: ${error.message}`);
  }
  return path;
}

/**
 * A time limited URL for reading one file, generated on demand rather
 * than stored anywhere. The bucket is private, so this signed URL is the
 * only way to actually fetch the file, and it stops working once
 * expiresInSeconds has passed. Supabase's own signed URLs support HTTP
 * range requests, so an <audio> element can seek without downloading the
 * whole file first.
 */
export async function createSignedFileUrl(path: string, expiresInSeconds: number): Promise<string> {
  const client = getClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Could not create a signed URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const client = getClient();
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) {
    throw new Error(`Could not delete file: ${error.message}`);
  }
}
