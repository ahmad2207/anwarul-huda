import { describe, expect, it } from "vitest";
import { CsvParseError, MAX_IMPORT_ROWS, parseCsvFile } from "./parse-csv";

function csvFile(content: string, name = "members.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("parseCsvFile", () => {
  it("parses a simple CSV into header keyed rows", async () => {
    const result = await parseCsvFile(csvFile("Surname,First Name\nBello,Amina\nOkafor,Chidi\n"));
    expect(result.headers).toEqual(["Surname", "First Name"]);
    expect(result.rows).toEqual([
      { Surname: "Bello", "First Name": "Amina" },
      { Surname: "Okafor", "First Name": "Chidi" },
    ]);
  });

  it("handles a quoted field containing a comma", async () => {
    const result = await parseCsvFile(
      csvFile('Surname,Address\nBello,"12 Sample Street, off Market Road"\n'),
    );
    expect(result.rows[0].Address).toBe("12 Sample Street, off Market Road");
  });

  it("handles a quoted field containing an embedded newline", async () => {
    const result = await parseCsvFile(csvFile('Surname,Notes\nBello,"Line one\nLine two"\n'));
    expect(result.rows[0].Notes).toBe("Line one\nLine two");
  });

  it("handles an escaped quote inside a quoted field", async () => {
    const result = await parseCsvFile(csvFile('Surname,Notes\nBello,"Say ""hello"""\n'));
    expect(result.rows[0].Notes).toBe('Say "hello"');
  });

  it("skips blank lines", async () => {
    const result = await parseCsvFile(csvFile("Surname,First Name\nBello,Amina\n\n\nOkafor,Chidi\n"));
    expect(result.rows).toHaveLength(2);
  });

  it("rejects a file with no data rows", async () => {
    await expect(parseCsvFile(csvFile("Surname,First Name\n"))).rejects.toBeInstanceOf(CsvParseError);
  });

  it("rejects a file over the row limit", async () => {
    const lines = ["Surname,First Name"];
    for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) {
      lines.push(`Bello${i},Amina`);
    }
    await expect(parseCsvFile(csvFile(lines.join("\n")))).rejects.toBeInstanceOf(CsvParseError);
  });
});
