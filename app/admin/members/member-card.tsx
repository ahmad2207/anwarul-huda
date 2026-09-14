// A single printable card: roughly credit-card proportions, eight of
// these fit on an A4 page in a 2x4 grid (app/admin/members/cards). Kept
// as a plain server component (no client interactivity), so the same
// markup works identically whether it is rendered once on its own page
// or eight times in a grid.
export function MemberCard({
  memberName,
  memberNumber,
  wingName,
  qrDataUrl,
}: {
  memberName: string;
  memberNumber: string;
  wingName: string;
  qrDataUrl: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-3" style={{ width: "85.6mm", height: "53.98mm" }}>
      <div className="flex flex-col justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Anwar-ul-Huda League</p>
          <p className="text-xs text-muted-foreground">{wingName}</p>
        </div>
        <div>
          <p className="text-sm font-medium">{memberName}</p>
          <p className="text-xs text-muted-foreground">{memberNumber}</p>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small server generated data URL */}
      <img src={qrDataUrl} alt={`QR code for ${memberNumber}`} width={72} height={72} />
    </div>
  );
}
