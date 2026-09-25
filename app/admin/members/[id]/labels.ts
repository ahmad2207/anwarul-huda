import type { CheckInMethod, GatheringType } from "@prisma/client";

export const GATHERING_TYPE_LABELS: Record<GatheringType, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export const CHECK_IN_METHOD_LABELS: Record<CheckInMethod, string> = {
  MANUAL: "By name",
  QR_CODE: "QR code",
  FINGERPRINT: "Fingerprint",
  FACE: "Face",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS: "POS",
  BANK_TRANSFER: "Bank transfer",
};
