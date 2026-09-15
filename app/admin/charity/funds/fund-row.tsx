"use client";

import { useState } from "react";
import type { Fund } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import { StatusTag } from "@/components/status-tag";
import { FundForm } from "./fund-form";

const TYPE_LABELS: Record<string, string> = {
  ZAKAT: "Zakat",
  SADAQAH: "Sadaqah",
  WAQF: "Waqf",
  GENERAL: "General or operational",
  APPEAL: "Special appeal",
};

export function FundRow({ fund, closingBalanceKobo }: { fund: Fund; closingBalanceKobo: number }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <FundForm fund={fund} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
      <span>
        <span className="font-medium">{fund.name}</span> &middot; {TYPE_LABELS[fund.type] ?? fund.type}{" "}
        &middot; balance {formatNaira(closingBalanceKobo)}
        {!fund.isActive ? (
          <>
            {" "}
            &middot; <StatusTag tone="neutral">Inactive</StatusTag>
          </>
        ) : null}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
        Edit
      </Button>
    </div>
  );
}
