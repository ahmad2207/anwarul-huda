import { normalizeNigerianPhone } from "@/lib/phone";
import { canAccessWing } from "@/lib/authorization";
import type { RoleName } from "@prisma/client";
import { IMPORT_FIELDS } from "./system-fields";

export type RowClassification = "clean" | "warning" | "fail";

export interface ImportRowIssue {
  /** The system field key this issue is about, or "row" for something not tied to one field. */
  field: string;
  message: string;
  severity: "warning" | "error";
}

export interface WingRef {
  id: string;
  name: string;
  numberLetter: string;
  code: string;
}

export interface BranchRef {
  id: string;
  name: string;
}

export interface ServiceAreaRef {
  id: string;
  name: string;
}

export interface ExistingMemberRef {
  id: string;
  memberNumber: string | null;
  surname: string | null;
  firstName: string | null;
  phone: string;
}

export interface ImportRefData {
  wings: WingRef[];
  branches: BranchRef[];
  serviceAreas: ServiceAreaRef[];
  existingByPhone: Map<string, ExistingMemberRef>;
  actor: { roles: RoleName[]; wingIds: string[] };
}

export interface ParsedMemberData {
  title: string | null;
  surname: string;
  firstName: string;
  otherNames: string | null;
  dateOfBirth: Date | null;
  gender: "MALE" | "FEMALE";
  maritalStatus: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | null;
  occupation: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  languages: string[];
  phone: string;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  landmark: string | null;
  preferredContact: "PHONE_CALL" | "SMS" | "WHATSAPP" | "EMAIL" | null;
  wingId: string;
  branchId: string | null;
  yearJoined: number | null;
  officeHeld: string | null;
  halaqah: string | null;
  islamicEducation: string | null;
  otherSkills: string | null;
  availability: string[];
  serviceAreaIds: string[];
  notes: string | null;
  accessNeeds: string | null;
  nokName: string | null;
  nokRelationship: string | null;
  nokPhone: string | null;
  nokAltPhone: string | null;
  consentRecords: boolean;
  consentDirectory: boolean;
  consentComms: boolean;
  consentBiometric: boolean;
}

export interface ValidatedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  /** Present only when classification is not "fail": a failed row cannot be safely imported. */
  data: ParsedMemberData | null;
  issues: ImportRowIssue[];
  classification: RowClassification;
  duplicate: ExistingMemberRef | null;
}

/** Maps the CSV row (by its original headers) to system field keys, using the confirmed mapping. */
export function applyColumnMapping(
  raw: Record<string, string>,
  mapping: Record<string, string | null>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field.key];
    mapped[field.key] = header ? (raw[header] ?? "").trim() : "";
  }
  return mapped;
}

export function validateImportRow(
  rowNumber: number,
  raw: Record<string, string>,
  mapped: Record<string, string>,
  refs: ImportRefData,
): ValidatedImportRow {
  const issues: ImportRowIssue[] = [];
  const fail = (field: string, message: string) => issues.push({ field, message, severity: "error" });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: "warning" });

  const surname = mapped.surname;
  if (!surname) fail("surname", "Surname is required");

  const firstName = mapped.firstName;
  if (!firstName) fail("firstName", "First name is required");

  const gender = parseGender(mapped.gender);
  if (!gender) fail("gender", `Gender must be Male or Female, got "${mapped.gender || ""}"`);

  let phone: string | null = null;
  if (!mapped.phone) {
    fail("phone", "Phone is required");
  } else {
    try {
      phone = normalizeNigerianPhone(mapped.phone);
    } catch {
      fail("phone", `"${mapped.phone}" is not a recognisable Nigerian phone number`);
    }
  }

  let wing: WingRef | null = null;
  if (!mapped.wing) {
    fail("wing", "Wing is required");
  } else {
    wing = resolveWing(mapped.wing, refs.wings);
    if (!wing) {
      fail("wing", `"${mapped.wing}" does not match a known wing`);
    } else if (!canAccessWing(refs.actor, wing.id)) {
      fail("wing", `You do not have access to import members into ${wing.name}`);
    }
  }

  // Optional fields: an unparseable or unrecognised value is a warning, not
  // a failure. The row still imports, with that one field left blank.
  const dateOfBirth = parseOptional(mapped.dateOfBirth, (value) => {
    const parsed = parseFlexibleDate(value);
    if (!parsed) warn("dateOfBirth", `"${value}" is not a date in YYYY-MM-DD or DD/MM/YYYY format`);
    return parsed;
  });

  const maritalStatus = parseOptional(mapped.maritalStatus, (value) => {
    const parsed = parseEnum(value, {
      single: "SINGLE",
      married: "MARRIED",
      divorced: "DIVORCED",
      widowed: "WIDOWED",
    } as const);
    if (!parsed) warn("maritalStatus", `"${value}" is not Single, Married, Divorced or Widowed`);
    return parsed;
  });

  const preferredContact = parseOptional(mapped.preferredContact, (value) => {
    const parsed = parseEnum(value, {
      "phone call": "PHONE_CALL",
      phone: "PHONE_CALL",
      sms: "SMS",
      whatsapp: "WHATSAPP",
      email: "EMAIL",
    } as const);
    if (!parsed) warn("preferredContact", `"${value}" is not Phone Call, SMS, WhatsApp or Email`);
    return parsed;
  });

  let altPhone: string | null = null;
  if (mapped.altPhone) {
    try {
      altPhone = normalizeNigerianPhone(mapped.altPhone);
    } catch {
      warn("altPhone", `"${mapped.altPhone}" is not a recognisable Nigerian phone number, left blank`);
    }
  }

  let nokPhone: string | null = null;
  if (mapped.nokPhone) {
    try {
      nokPhone = normalizeNigerianPhone(mapped.nokPhone);
    } catch {
      warn("nokPhone", `"${mapped.nokPhone}" is not a recognisable Nigerian phone number, left blank`);
    }
  }

  let nokAltPhone: string | null = null;
  if (mapped.nokAltPhone) {
    try {
      nokAltPhone = normalizeNigerianPhone(mapped.nokAltPhone);
    } catch {
      warn("nokAltPhone", `"${mapped.nokAltPhone}" is not a recognisable Nigerian phone number, left blank`);
    }
  }

  let email: string | null = null;
  if (!mapped.email) {
    warn("email", "No email provided");
  } else if (!isLikelyEmail(mapped.email)) {
    warn("email", `"${mapped.email}" is not a valid email address, left blank`);
  } else {
    email = mapped.email.toLowerCase();
  }

  let yearJoined: number | null = null;
  if (mapped.yearJoined) {
    const parsedYear = Number(mapped.yearJoined);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      warn("yearJoined", `"${mapped.yearJoined}" is not a valid year, left blank`);
    } else {
      yearJoined = parsedYear;
    }
  }

  let branchId: string | null = null;
  if (mapped.branch) {
    const branch = refs.branches.find((b) => b.name.toLowerCase() === mapped.branch.toLowerCase());
    if (!branch) {
      warn("branch", `"${mapped.branch}" does not match a known branch, left unassigned`);
    } else {
      branchId = branch.id;
    }
  }

  const serviceAreaIds: string[] = [];
  if (mapped.serviceAreas) {
    const names = splitList(mapped.serviceAreas);
    const unmatched: string[] = [];
    for (const name of names) {
      const area = refs.serviceAreas.find((a) => a.name.toLowerCase() === name.toLowerCase());
      if (area) {
        serviceAreaIds.push(area.id);
      } else {
        unmatched.push(name);
      }
    }
    if (unmatched.length > 0) {
      warn("serviceAreas", `Not recognised, skipped: ${unmatched.join(", ")}`);
    }
  }

  const duplicate = phone ? refs.existingByPhone.get(phone) ?? null : null;

  const classification: RowClassification = issues.some((issue) => issue.severity === "error")
    ? "fail"
    : issues.length > 0
      ? "warning"
      : "clean";

  const data: ParsedMemberData | null =
    classification === "fail"
      ? null
      : {
          title: mapped.title || null,
          surname,
          firstName,
          otherNames: mapped.otherNames || null,
          dateOfBirth,
          gender: gender!,
          maritalStatus,
          occupation: mapped.occupation || null,
          nationality: mapped.nationality || null,
          stateOfOrigin: mapped.stateOfOrigin || null,
          languages: splitList(mapped.languages),
          phone: phone!,
          altPhone,
          email,
          address: mapped.address || null,
          city: mapped.city || null,
          state: mapped.state || null,
          landmark: mapped.landmark || null,
          preferredContact,
          wingId: wing!.id,
          branchId,
          yearJoined,
          officeHeld: mapped.officeHeld || null,
          halaqah: mapped.halaqah || null,
          islamicEducation: mapped.islamicEducation || null,
          otherSkills: mapped.otherSkills || null,
          availability: splitList(mapped.availability),
          serviceAreaIds,
          notes: mapped.notes || null,
          accessNeeds: mapped.accessNeeds || null,
          nokName: mapped.nokName || null,
          nokRelationship: mapped.nokRelationship || null,
          nokPhone,
          nokAltPhone,
          consentRecords: parseYesNo(mapped.consentRecords) ?? false,
          consentDirectory: parseYesNo(mapped.consentDirectory) ?? false,
          consentComms: parseYesNo(mapped.consentComms) ?? false,
          consentBiometric: parseYesNo(mapped.consentBiometric) ?? false,
        };

  return { rowNumber, raw, data, issues, classification, duplicate };
}

function parseOptional<T>(value: string, parse: (value: string) => T | null): T | null {
  if (!value) return null;
  return parse(value);
}

function parseGender(value: string): "MALE" | "FEMALE" | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") return "MALE";
  if (normalized === "female" || normalized === "f") return "FEMALE";
  return null;
}

function parseEnum<T extends string>(value: string, table: Record<string, T>): T | null {
  return table[value.trim().toLowerCase()] ?? null;
}

function parseYesNo(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return true;
  if (["no", "n", "false", "0", ""].includes(normalized)) return false;
  return null;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function splitList(value: string): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveWing(value: string, wings: WingRef[]): WingRef | null {
  const normalized = value.trim().toLowerCase();
  return (
    wings.find((wing) => wing.name.toLowerCase() === normalized) ??
    wings.find((wing) => wing.numberLetter.toLowerCase() === normalized) ??
    wings.find((wing) => wing.code.toLowerCase() === normalized) ??
    null
  );
}

/**
 * Parses YYYY-MM-DD or DD/MM/YYYY (the day-first convention used on the
 * paper form), never the ambiguous MM/DD/YYYY a bare `new Date(string)`
 * would assume. Rejects a date that does not really exist (31 February)
 * rather than letting it silently roll over into March.
 */
function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildUtcDate(Number(year), Number(month), Number(day));
  }

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return buildUtcDate(Number(year), Number(month), Number(day));
  }

  return null;
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}
