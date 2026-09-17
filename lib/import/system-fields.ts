// The canonical set of columns the CSV import understands, in the order
// they appear in the paper Member Information Form. The template download
// and the column mapping guesser both come from this single list, so they
// can never drift apart.

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  /** Extra header spellings this field should also match when guessing the mapping. */
  aliases: string[];
  /** Shown in the template and the mapping step, to explain the expected format. */
  hint?: string;
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: "title", label: "Title", required: false, aliases: [] },
  { key: "surname", label: "Surname", required: true, aliases: ["last name", "family name"] },
  { key: "firstName", label: "First Name", required: true, aliases: ["given name"] },
  { key: "otherNames", label: "Other Names", required: false, aliases: ["middle name", "middle names"] },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    required: false,
    aliases: ["dob", "birth date"],
    hint: "YYYY-MM-DD or DD/MM/YYYY",
  },
  { key: "gender", label: "Gender", required: true, aliases: ["sex"], hint: "Male or Female" },
  {
    key: "maritalStatus",
    label: "Marital Status",
    required: false,
    aliases: [],
    hint: "Single, Married, Divorced or Widowed",
  },
  { key: "occupation", label: "Occupation", required: false, aliases: ["job", "profession"] },
  { key: "nationality", label: "Nationality", required: false, aliases: [] },
  { key: "stateOfOrigin", label: "State of Origin", required: false, aliases: [] },
  { key: "languages", label: "Languages", required: false, aliases: ["languages spoken"], hint: "separate with ;" },
  { key: "phone", label: "Phone", required: true, aliases: ["mobile", "phone number", "mobile number"] },
  { key: "altPhone", label: "Alternative Phone", required: false, aliases: ["alt phone", "second phone"] },
  { key: "email", label: "Email", required: false, aliases: ["email address"] },
  { key: "address", label: "Address", required: false, aliases: [] },
  { key: "city", label: "City", required: false, aliases: [] },
  { key: "state", label: "State", required: false, aliases: [] },
  { key: "landmark", label: "Landmark", required: false, aliases: ["nearest landmark"] },
  {
    key: "preferredContact",
    label: "Preferred Contact",
    required: false,
    aliases: ["preferred contact channel"],
    hint: "Phone Call, SMS, WhatsApp or Email",
  },
  { key: "wing", label: "Wing", required: true, aliases: [], hint: "the wing's name or its M/W/Y letter" },
  { key: "branch", label: "Branch", required: false, aliases: ["masjid", "masjid or branch"] },
  { key: "yearJoined", label: "Year Joined", required: false, aliases: [] },
  { key: "officeHeld", label: "Office Held", required: false, aliases: ["office", "role"] },
  { key: "halaqah", label: "Halaqah", required: false, aliases: ["usrah", "halaqah or usrah group"] },
  { key: "islamicEducation", label: "Islamic Education", required: false, aliases: ["qualifications"] },
  { key: "otherSkills", label: "Other Skills", required: false, aliases: ["skills"] },
  {
    key: "availability",
    label: "Availability",
    required: false,
    aliases: ["general availability"],
    hint: "separate with ;",
  },
  {
    key: "serviceAreas",
    label: "Areas of Service",
    required: false,
    aliases: ["service areas"],
    hint: "separate with ;, must match existing area names",
  },
  { key: "notes", label: "Notes", required: false, aliases: [] },
  { key: "accessNeeds", label: "Access Needs", required: false, aliases: [] },
  { key: "nokName", label: "Next of Kin Name", required: false, aliases: ["nok name"] },
  { key: "nokRelationship", label: "Next of Kin Relationship", required: false, aliases: ["nok relationship"] },
  { key: "nokPhone", label: "Next of Kin Phone", required: false, aliases: ["nok phone"] },
  {
    key: "nokAltPhone",
    label: "Next of Kin Alternative Phone",
    required: false,
    aliases: ["nok alternative phone"],
  },
  { key: "consentRecords", label: "Consent to Records", required: false, aliases: [], hint: "Yes or No" },
  { key: "consentDirectory", label: "Consent to Directory", required: false, aliases: [], hint: "Yes or No" },
  {
    key: "consentComms",
    label: "Consent to Communications",
    required: false,
    aliases: ["consent communications"],
    hint: "Yes or No",
  },
  { key: "consentBiometric", label: "Consent to Biometric", required: false, aliases: [], hint: "Yes or No" },
];

/**
 * Guesses which CSV header belongs to each system field, by exact match on
 * the field's label or one of its aliases, ignoring case and punctuation.
 * The user corrects this on the mapping step, it is never used unchecked.
 */
export function guessColumnMapping(headers: string[]): Record<string, string | null> {
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  const mapping: Record<string, string | null> = {};

  for (const field of IMPORT_FIELDS) {
    const candidates = new Set([field.label, ...field.aliases].map(normalizeHeader));
    const match = normalizedHeaders.find((header) => candidates.has(header.normalized));
    mapping[field.key] = match ? match.raw : null;
  }

  return mapping;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A historical nominal roll: names only, never split, no phone. A
// genuinely different, smaller column set from IMPORT_FIELDS above,
// because it enforces different rules on the same idea (an existing
// member, typed up from paper), not a relaxed version of the same rules.
export const NOMINAL_ROLL_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: "fullName",
    label: "Full Name",
    required: true,
    aliases: ["full name as written", "name as written", "name", "full_name_as_written", "name_as_written"],
  },
  { key: "wing", label: "Wing", required: true, aliases: [], hint: "the wing's name or its M/W/Y letter" },
  { key: "gender", label: "Gender", required: true, aliases: ["sex"], hint: "Male or Female" },
  { key: "title", label: "Title", required: false, aliases: [] },
  { key: "sourceSn", label: "Source Serial Number", required: false, aliases: ["source_sn", "s/n", "sn"] },
  { key: "sourcePage", label: "Source Page", required: false, aliases: ["source_page", "page"] },
  {
    key: "needsReview",
    label: "Needs Review",
    required: false,
    aliases: ["needs_review", "review", "notes"],
    hint: "carried into the member's notes, never lost",
  },
];

export function guessNominalRollColumnMapping(headers: string[]): Record<string, string | null> {
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  const mapping: Record<string, string | null> = {};

  for (const field of NOMINAL_ROLL_IMPORT_FIELDS) {
    const candidates = new Set([field.label, ...field.aliases].map(normalizeHeader));
    const match = normalizedHeaders.find((header) => candidates.has(header.normalized));
    mapping[field.key] = match ? match.raw : null;
  }

  return mapping;
}
