import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every DateTime column in this schema must be @db.Timestamptz. Plain
// DateTime maps to Postgres "timestamp without time zone", a naive wall
// clock reading with no timezone attached to it: proven directly (see
// prisma/migrations/20260917074618_datetime_columns_timestamptz) to
// silently shift by the server's local UTC offset when read back a
// different way than it was written, which is worse specifically
// because it is environment dependent (Africa/Lagos locally, UTC on
// Vercel) rather than consistently wrong everywhere. This test reads the
// schema as text and fails the moment a new plain DateTime field is
// added, rather than relying on a reviewer to remember this the next
// time a model gains a timestamp.

const SCHEMA_PATH = path.resolve(import.meta.dirname, "schema.prisma");

interface DateTimeFieldLine {
  lineNumber: number;
  text: string;
  hasTimestamptz: boolean;
}

// A field declaration line: leading whitespace, a field name, then its
// type. Only matches when DateTime is the type itself (optionally
// followed by "?"), not merely mentioned somewhere else on the line (a
// comment, a doc string), by requiring it to immediately follow the
// field name with only whitespace between them.
const FIELD_DECLARATION_PATTERN = /^\s*[A-Za-z][A-Za-z0-9_]*\s+DateTime(\?)?(\s|$)/;

function findDateTimeFieldLines(schemaText: string): DateTimeFieldLine[] {
  const lines = schemaText.split("\n");
  const results: DateTimeFieldLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // A full-line comment can still contain the word DateTime (as this
    // test's own doc comment above does); it is never a field
    // declaration, so it is excluded before the pattern is even tried.
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/**")) {
      continue;
    }

    if (FIELD_DECLARATION_PATTERN.test(line)) {
      results.push({
        lineNumber: i + 1,
        text: trimmed,
        hasTimestamptz: line.includes("@db.Timestamptz"),
      });
    }
  }

  return results;
}

describe("every DateTime column is timestamptz", () => {
  const schemaText = readFileSync(SCHEMA_PATH, "utf-8");
  const dateTimeFields = findDateTimeFieldLines(schemaText);

  it("finds at least the DateTime fields already known to exist, so this test is not silently matching nothing", () => {
    // A floor, not an exact count: new DateTime fields are expected to
    // be added over time, and should all pass the next check. This only
    // guards against the parser itself regressing to zero matches.
    expect(dateTimeFields.length).toBeGreaterThanOrEqual(45);
  });

  it("declares @db.Timestamptz on every DateTime field", () => {
    const missing = dateTimeFields.filter((field) => !field.hasTimestamptz);
    const description = missing.map((field) => `  line ${field.lineNumber}: ${field.text}`).join("\n");

    expect(
      missing,
      missing.length > 0
        ? `Found a plain DateTime field with no @db.Timestamptz(3) (stores a naive timestamp, see this file's own comment for why that is a real bug, not a style preference):\n${description}`
        : undefined,
    ).toEqual([]);
  });
});
