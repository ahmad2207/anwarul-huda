import { parse } from "csv-parse";
import { Readable } from "node:stream";

export const MAX_IMPORT_ROWS = 5000;

export class CsvParseError extends Error {}

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Parses an uploaded CSV file with a streaming parser, so a large file is
 * processed incrementally rather than as one blocking pass over the whole
 * buffer. Refuses anything over MAX_IMPORT_ROWS rather than accepting it
 * and running out of memory partway through validation.
 */
export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const parser = Readable.from(buffer).pipe(
    parse({
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }),
  );

  const rows: Array<Record<string, string>> = [];
  let headers: string[] = [];

  try {
    for await (const record of parser as AsyncIterable<Record<string, string>>) {
      if (headers.length === 0) {
        headers = Object.keys(record);
      }
      if (rows.length >= MAX_IMPORT_ROWS) {
        parser.destroy();
        throw new CsvParseError(
          `This file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files and import them one at a time.`,
        );
      }
      rows.push(record);
    }
  } catch (error) {
    if (error instanceof CsvParseError) {
      throw error;
    }
    throw new CsvParseError("Could not read this file. Check it is a valid CSV export.");
  }

  if (rows.length === 0) {
    throw new CsvParseError("This file has no data rows.");
  }

  return { headers, rows };
}
