// Builds the one credential-issue output MEMBER-INTERFACE.md 2 and
// DESIGN.md section 7 ask for: a printable slip, eight to an A4 page.
// No WhatsApp message (dropped: almost no member has a phone on file
// yet to send one to, and section 3 of the record, not built yet, is
// what starts changing that). No phone on the slip either, for the same
// reason it is not the login identifier any more: member number is.
//
// Built from data the caller already holds in memory, from the direct
// response to issuing a login, never fetched again afterwards: the
// temporary password is never persisted anywhere a later request could
// retrieve it from, so there is nothing for a page reload, a route, or a
// second tab to reconstruct this from. See lib/print/open-print-window.ts
// for how the sheet actually reaches the printer.

export interface LoginSlipData {
  memberName: string;
  memberNumber: string | null;
  temporaryPassword: string;
}

const SLIPS_PER_PAGE = 8;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSlip(slip: LoginSlipData, logoUrl: string): string {
  return `
    <div class="slip">
      <div class="header">
        <img src="${escapeHtml(logoUrl)}" alt="" />
        <div class="header-text">
          <span class="org">Anwaru-l-Huda League of Nigeria</span>
          <span class="org-arabic" dir="rtl" lang="ar" style="unicode-bidi: isolate;">رابطة أنوار الهدى نيجيريا</span>
        </div>
      </div>
      <p class="row"><span class="label">Member</span> ${escapeHtml(slip.memberName)}</p>
      <p class="row"><span class="label">Member number</span> <span class="mono">${escapeHtml(slip.memberNumber ?? "Not yet issued")}</span></p>
      <p class="row"><span class="label">Temporary password</span></p>
      <p class="password mono">${escapeHtml(slip.temporaryPassword)}</p>
      <p class="row small">Sign in with the member number and password above at the league's sign-in page.</p>
    </div>`;
}

/**
 * A complete, self contained HTML document: one slip, or a full sheet of
 * them for a bulk issue, eight to an A4 page, none split across a page
 * break. Its own print stylesheet (DESIGN.md section 7: black on white,
 * no background fills, the logo and the Arabic line in the header, mono
 * for the member number and the password). Opened directly into a new
 * window by openPrintWindow, never served as a route, since a route
 * could only be reached by reloading or revisiting it, and there is
 * nothing left to reload this from.
 */
export function buildLoginSlipsHtml(slips: LoginSlipData[], logoUrl: string): string {
  const title = slips.length === 1 ? `Login slip, ${slips[0].memberName}` : `Login slips (${slips.length})`;

  const pages: LoginSlipData[][] = [];
  for (let i = 0; i < slips.length; i += SLIPS_PER_PAGE) {
    pages.push(slips.slice(i, i + SLIPS_PER_PAGE));
  }

  const pagesHtml = pages
    .map(
      (page, pageIndex) => `
    <div class="sheet"${pageIndex < pages.length - 1 ? ' style="page-break-after: always;"' : ""}>
      ${page.map((slip) => renderSlip(slip, logoUrl)).join("")}
    </div>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 0; padding: 8mm;
  }
  .toolbar { margin-bottom: 6mm; }
  .toolbar button {
    font-family: inherit; font-size: 13px; padding: 6px 16px; margin-right: 8px;
    border: 1px solid #000; background: #fff; color: #000; border-radius: 4px; cursor: pointer;
  }
  .mono { font-family: "IBM Plex Mono", "Courier New", monospace; }

  /* Two columns, four rows: eight slips fill one A4 page exactly,
     matching the 2x4 grid the member card already uses
     (app/admin/members/member-card.tsx). */
  .sheet {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: 5mm;
    /* 297mm page height minus the @page margin (12mm top and bottom)
       minus this body's own padding (8mm top and bottom): what is left
       for the grid to fill exactly one page with no overflow. */
    height: 257mm;
  }
  .sheet + .sheet { margin-top: 8mm; }

  .slip {
    border: 1px solid #000;
    border-radius: 4px;
    padding: 5mm;
    display: flex;
    flex-direction: column;
    gap: 2mm;
    /* The one rule point 6 asks for by name: never let a slip's own
       content be the reason a page breaks in the middle of it. */
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .header {
    display: flex; align-items: center; gap: 6px; margin-bottom: 1mm;
    border-bottom: 1px solid #000; padding-bottom: 2mm;
  }
  .header img { width: 26px; height: 26px; flex-shrink: 0; }
  .header-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
  .org { font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
  .org-arabic {
    font-family: "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif; font-size: 9px; font-weight: 600;
    text-align: right;
  }
  .row { margin: 0; font-size: 10px; }
  .row.small { font-size: 8px; color: #333; margin-top: auto; }
  .label { color: #333; }
  .password {
    font-size: 15px; letter-spacing: 0.12em;
    border: 1px dashed #000; padding: 1.5mm 2.5mm; display: inline-block; width: fit-content;
  }

  @media print {
    .toolbar { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print</button>
    <button type="button" onclick="window.close()">Close</button>
  </div>
  ${pagesHtml}
</body>
</html>`;
}
