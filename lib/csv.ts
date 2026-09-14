// A minimal RFC 4180 style CSV writer: quotes a field only when it needs
// it (contains a comma, a quote or a newline), and escapes a quote by
// doubling it. Parsing an uploaded CSV uses the csv-parse dependency
// (lib/import/parse-csv.ts); writing one out is simple enough not to need
// a library.

export function toCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: string[]): string {
  return values.map(toCsvField).join(",");
}

export function toCsvDocument(header: string[], rows: string[][]): string {
  return [toCsvRow(header), ...rows.map(toCsvRow)].join("\n") + "\n";
}
