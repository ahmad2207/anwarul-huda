import QRCode from "qrcode";

/**
 * A QR code for a member's card, encoding their member number directly
 * (docs/SPEC.md 2.6: "every member has a QR code... containing the
 * member number"). Rendered server side to a data URL, so the member
 * profile and the printed card sheet can both just use it as an <img
 * src>, no client side QR library needed to display one, only to scan
 * one (app/admin/attendance/[id]/qr-scanner.tsx).
 */
export async function generateMemberQrDataUrl(memberNumber: string): Promise<string> {
  return QRCode.toDataURL(memberNumber, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}
