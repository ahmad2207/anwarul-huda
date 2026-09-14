import { requireRole } from "@/lib/auth";
import { IMPORT_FIELDS } from "@/lib/import/system-fields";

function toCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// One clearly fictional example row, so the template is not just a bare
// header line. Never real data, matching the same rule seed.ts follows.
const EXAMPLE_ROW: Record<string, string> = {
  title: "Alhaji",
  surname: "Example",
  firstName: "Amina",
  otherNames: "",
  dateOfBirth: "1985-04-12",
  gender: "Female",
  maritalStatus: "Married",
  occupation: "Teacher",
  nationality: "Nigerian",
  stateOfOrigin: "Kano",
  languages: "Hausa;English",
  phone: "08012345678",
  altPhone: "",
  email: "amina.example@example.test",
  address: "12 Sample Street",
  city: "Kano",
  state: "Kano",
  landmark: "Near the market",
  preferredContact: "WhatsApp",
  wing: "Women's wing",
  branch: "",
  yearJoined: "2019",
  officeHeld: "",
  halaqah: "",
  islamicEducation: "",
  otherSkills: "",
  availability: "",
  serviceAreas: "",
  notes: "",
  accessNeeds: "",
  nokName: "Bello Example",
  nokRelationship: "Husband",
  nokPhone: "08098765432",
  nokAltPhone: "",
  consentRecords: "Yes",
  consentDirectory: "No",
  consentComms: "Yes",
  consentBiometric: "No",
};

export async function GET() {
  await requireRole(["WING_ADMIN"]);

  const header = IMPORT_FIELDS.map((field) => toCsvField(field.label)).join(",");
  const exampleRow = IMPORT_FIELDS.map((field) => toCsvField(EXAMPLE_ROW[field.key] ?? "")).join(",");
  const csv = `${header}\n${exampleRow}\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="member-import-template.csv"',
    },
  });
}
