import { canAccessWing } from "@/lib/authorization";
import type { RoleName } from "@prisma/client";
import type { ImportRowIssue, RowClassification, WingRef } from "./validate-row";

// A recognised job title appended to a name on the roll, rather than a
// second given name (Ganiyu Tailor, Ibrahim Danladi Security, and so on).
// Only split off when the row is itself flagged "job title appended to
// name", never guessed from the word alone: an ordinary member could
// genuinely be named Tailor or Baker.
const OFFICE_TITLE_FLAG = "job title appended to name";
const DUPLICATE_SN_PATTERN = /possible duplicate of s\/n\s*(\d+)/i;

export interface NominalRollRefData {
  wings: WingRef[];
  actor: { roles: RoleName[]; wingIds: string[] };
}

export interface ParsedNominalRollData {
  fullNameAsWritten: string;
  /** Present only when needsReview flagged this row as a name with a job title appended to it: the title word, split off for officeHeld. */
  officeHeld: string | null;
  title: string | null;
  gender: "MALE" | "FEMALE";
  wingId: string;
  /** The roll's own serial number for this row, used only to resolve "possible duplicate of S/N n" into a real member ID once every row in the batch has been written. Never stored on the member. */
  sourceSn: string | null;
  sourcePage: string | null;
  /** needs_review verbatim, plus the source reference, carried into the member's notes so neither is lost. */
  notes: string | null;
  /** The S/N this row's needs_review flagged as a possible duplicate, if any, resolved after every row is written. */
  duplicateOfSn: string | null;
}

export interface ValidatedNominalRollRow {
  rowNumber: number;
  raw: Record<string, string>;
  data: ParsedNominalRollData | null;
  issues: ImportRowIssue[];
  classification: RowClassification;
}

export function validateNominalRollRow(
  rowNumber: number,
  raw: Record<string, string>,
  mapped: Record<string, string>,
  refs: NominalRollRefData,
): ValidatedNominalRollRow {
  const issues: ImportRowIssue[] = [];
  const fail = (field: string, message: string) => issues.push({ field, message, severity: "error" });

  const fullName = mapped.fullName;
  if (!fullName) fail("fullName", "Full name is required");

  const gender = parseGender(mapped.gender);
  if (!gender) fail("gender", `Gender must be Male or Female, got "${mapped.gender || ""}"`);

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

  const needsReview = mapped.needsReview || "";
  const sourceSn = mapped.sourceSn || null;
  const sourcePage = mapped.sourcePage || null;

  const classification: RowClassification = issues.some((issue) => issue.severity === "error") ? "fail" : "clean";

  let data: ParsedNominalRollData | null = null;
  if (classification !== "fail") {
    let nameForRecord = fullName;
    let officeHeld: string | null = null;
    if (needsReview.toLowerCase().includes(OFFICE_TITLE_FLAG)) {
      const words = fullName.trim().split(/\s+/);
      if (words.length > 1) {
        officeHeld = words[words.length - 1];
        nameForRecord = words.slice(0, -1).join(" ");
      }
    }

    const duplicateMatch = needsReview.match(DUPLICATE_SN_PATTERN);

    const noteParts: string[] = [];
    if (needsReview) noteParts.push(`From the source roll: ${needsReview}.`);
    if (officeHeld) {
      noteParts.push(
        `"${officeHeld}" was appended to this name on the roll and has been recorded as office held instead. Whether mosque staff belong on the membership register is a committee decision; confirm before treating this as an ordinary membership record.`,
      );
    }
    if (sourceSn || sourcePage) {
      noteParts.push(
        `Source roll reference: ${sourceSn ? `S/N ${sourceSn}` : "no S/N"}${sourcePage ? `, page ${sourcePage}` : ""}.`,
      );
    }

    data = {
      fullNameAsWritten: nameForRecord,
      officeHeld,
      title: mapped.title || null,
      gender: gender!,
      wingId: wing!.id,
      sourceSn,
      sourcePage,
      notes: noteParts.length > 0 ? noteParts.join(" ") : null,
      duplicateOfSn: duplicateMatch ? duplicateMatch[1] : null,
    };
  }

  return { rowNumber, raw, data, issues, classification };
}

function parseGender(value: string): "MALE" | "FEMALE" | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") return "MALE";
  if (normalized === "female" || normalized === "f") return "FEMALE";
  return null;
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
