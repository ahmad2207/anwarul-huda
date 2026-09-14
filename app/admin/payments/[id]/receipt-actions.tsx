"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReceiptActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked by the browser; the text area
      // below is still there to select and copy by hand.
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()}>
        Print
      </Button>
      <Button type="button" variant="outline" onClick={handleCopy}>
        {copied ? "Copied" : "Copy for WhatsApp"}
      </Button>
    </div>
  );
}
