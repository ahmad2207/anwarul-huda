"use client";

import { useState } from "react";
import { computeAuditDiff } from "@/lib/audit/diff";

export interface AuditRowData {
  id: string;
  createdAt: string;
  actorLabel: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "(none)";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function AuditRow({ entry }: { entry: AuditRowData }) {
  const [open, setOpen] = useState(false);
  const diff = computeAuditDiff(entry.before, entry.after);

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/30">
        <td className="p-2 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString("en-NG")}</td>
        <td className="p-2">{entry.actorLabel}</td>
        <td className="p-2">{entry.action}</td>
        <td className="p-2">
          {entry.entity} <span className="text-xs text-muted-foreground">{entry.entityId}</span>
        </td>
        <td className="p-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-medium underline underline-offset-2"
          >
            {open ? "Hide" : "View"} changes
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b last:border-0 bg-muted/20">
          <td colSpan={5} className="p-2">
            {diff.length === 0 ? (
              <p className="text-xs text-muted-foreground">No field level changes recorded for this entry.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-1 font-medium">Field</th>
                    <th className="p-1 font-medium">Before</th>
                    <th className="p-1 font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((row) => (
                    <tr key={row.field}>
                      <td className="p-1 font-medium">{row.field}</td>
                      <td className="p-1 text-muted-foreground">{formatValue(row.before)}</td>
                      <td className="p-1">{formatValue(row.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
