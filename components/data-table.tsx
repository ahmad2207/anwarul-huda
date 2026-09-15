// DESIGN.md 4.1 and section 5: rows, not cards, for tabular data, with a
// sticky header, hairline separators and no zebra striping. This is the
// one place that markup is written; every admin list and report table
// hands it a column list and a row list instead of repeating the table,
// thead and empty-row boilerplate by hand.

export interface DataTableColumn<T> {
  /** Unique within one table, used as the React key for header and cells. */
  key: string;
  header: React.ReactNode;
  /** Right-aligns the column, for the money and count columns DESIGN.md calls out. Left is the default. */
  align?: "left" | "right";
  cell: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b bg-muted text-left">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`p-2 font-medium ${column.align === "right" ? "text-right" : ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/30">
              {columns.map((column) => (
                <td key={column.key} className={`p-2 ${column.align === "right" ? "text-right" : ""}`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
