import { requireRole } from "@/lib/auth";
import { IMPORT_FIELDS } from "@/lib/import/system-fields";
import { toCsvDocument } from "@/lib/csv";

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

  const csv = toCsvDocument(
    IMPORT_FIELDS.map((field) => field.label),
    [IMPORT_FIELDS.map((field) => EXAMPLE_ROW[field.key] ?? "")],
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="member-import-template.csv"',
    },
  });
}
