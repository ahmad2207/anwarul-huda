import { PrismaClient, FundType, Frequency, WingCode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Wings, and the youth upper age limit, are open committee decisions per
// docs/SPEC.md section 7 questions 1 and 4. minAge and maxAge are left null
// here rather than guessed.
const WINGS: Array<{ code: WingCode; name: string; numberLetter: string }> = [
  { code: "MENS", name: "Men's wing", numberLetter: "M" },
  { code: "WOMENS", name: "Women's wing", numberLetter: "W" },
  { code: "YOUTH", name: "Youth wing", numberLetter: "Y" },
];

// docs/SPEC.md lists "areas of service" as a field on the member form but
// never enumerates the standard list. This is a placeholder set typical of
// a mosque organisation, seeded so the field has options to pick from.
// Confirm the real list with the committee and edit this seed accordingly.
const SERVICE_AREAS = [
  "Da'wah",
  "Islamic education",
  "Welfare",
  "Ushering",
  "Media and publicity",
  "Security",
  "Event logistics",
  "Finance support",
];

const FUND_TYPES: Array<{ type: FundType; name: string; description: string }> = [
  { type: "ZAKAT", name: "Zakat fund", description: "Ring fenced. Disbursed only against one of the eight zakat categories." },
  { type: "SADAQAH", name: "Sadaqah fund", description: "General voluntary charity." },
  { type: "WAQF", name: "Waqf fund", description: "Endowment fund." },
  { type: "GENERAL", name: "General fund", description: "Operational and running costs." },
  { type: "APPEAL", name: "Example special appeal", description: "A special appeal, created as needed. Placeholder for the pattern, not a real appeal." },
];

async function main() {
  console.log("Seeding Anwar-ul-Huda League data. All names below are fictional.");

  const wingsByCode = new Map<WingCode, { id: string }>();
  for (const wing of WINGS) {
    const record = await prisma.wing.upsert({
      where: { code: wing.code },
      update: { name: wing.name, numberLetter: wing.numberLetter },
      create: wing,
    });
    wingsByCode.set(wing.code, record);
    console.log(`Wing ready: ${wing.name} (${wing.numberLetter})`);
  }

  const branch = await prisma.branch.upsert({
    where: { id: "default-branch" },
    update: {},
    create: {
      id: "default-branch",
      name: "Anwar-ul-Huda Central Masjid (example branch)",
      city: "Lagos",
      state: "Lagos",
      isDefault: true,
    },
  });
  console.log(`Default branch ready: ${branch.name}`);

  for (const area of SERVICE_AREAS) {
    await prisma.serviceArea.upsert({
      where: { name: area },
      update: {},
      create: { name: area },
    });
  }
  console.log(`${SERVICE_AREAS.length} service areas ready (placeholder list, confirm with the committee).`);

  for (const fund of FUND_TYPES) {
    const existing = await prisma.fund.findFirst({ where: { type: fund.type } });
    if (existing) {
      await prisma.fund.update({
        where: { id: existing.id },
        data: { name: fund.name, description: fund.description },
      });
    } else {
      await prisma.fund.create({ data: fund });
    }
  }
  console.log(`${FUND_TYPES.length} fund types ready.`);

  // Contribution plan amounts are illustrative only. Real names, amounts and
  // frequencies are an open committee decision per docs/SPEC.md section 7
  // question 3.
  const monthlyDuesPlan = await prisma.contributionPlan.findFirst({
    where: { name: "Monthly dues (example)" },
  });
  if (!monthlyDuesPlan) {
    await prisma.contributionPlan.create({
      data: {
        name: "Monthly dues (example)",
        description: "Illustrative plan. Confirm the real amount with the committee.",
        amountKobo: 50000, // N500.00
        frequency: Frequency.MONTHLY,
        wingId: null, // all wings
      },
    });
  }

  const eidLevyPlan = await prisma.contributionPlan.findFirst({
    where: { name: "Eid levy (example)" },
  });
  if (!eidLevyPlan) {
    await prisma.contributionPlan.create({
      data: {
        name: "Eid levy (example)",
        description: "Illustrative plan. Confirm the real amount with the committee.",
        amountKobo: 200000, // N2,000.00
        frequency: Frequency.ANNUAL,
        wingId: null, // all wings
      },
    });
  }
  console.log("2 example contribution plans ready.");

  // The super admin is a system account, obviously fictional, not a real
  // member. Change this password before any real deployment.
  const superAdminEmail = "superadmin@ahl-league.test";
  const superAdminPassword = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      phone: "+2348000000000",
      passwordHash,
      isActive: true,
    },
  });

  // RoleName is an enum, not a table, so "seeding the seven roles" means
  // making sure at least one user demonstrates a role assignment. The
  // other six roles (WING_ADMIN, FINANCE_OFFICER, CHARITY_OFFICER,
  // ATTENDANCE_OFFICER, CONTENT_EDITOR, MEMBER) are assigned to real users
  // as they are created in later phases.
  await prisma.userRole.upsert({
    where: { userId_role: { userId: superAdmin.id, role: "SUPER_ADMIN" } },
    update: {},
    create: { userId: superAdmin.id, role: "SUPER_ADMIN" },
  });

  console.log(`Super admin ready: ${superAdminEmail} / ${superAdminPassword} (change this password)`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
