export interface AuditDiffRow {
  field: string;
  before: unknown;
  after: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Compares the before and after JSON snapshots stored on one audit entry
 * and returns only the fields that actually differ. Either side can be
 * missing: a creation has no before, a deletion has no after, in which
 * case every field on the side that does exist shows as changed. Neither
 * snapshot is assumed to be a plain object (a bulk write sometimes stores
 * a small summary instead of a full row), so anything not shaped like one
 * is treated as empty rather than thrown on.
 */
export function computeAuditDiff(before: unknown, after: unknown): AuditDiffRow[] {
  const beforeObj = isRecord(before) ? before : {};
  const afterObj = isRecord(after) ? after : {};
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  const rows: AuditDiffRow[] = [];
  for (const key of keys) {
    const b = beforeObj[key];
    const a = afterObj[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      rows.push({ field: key, before: b, after: a });
    }
  }

  return rows.sort((x, y) => x.field.localeCompare(y.field));
}
