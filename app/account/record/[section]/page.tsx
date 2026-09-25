import { notFound } from "next/navigation";
import type { Branch, HouseholdMember, Member, ServiceArea, Wing } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findRecordSection, RECORD_SECTIONS } from "@/lib/members/record-sections";
import { NameSectionForm } from "./name-form";
import { AboutSectionForm } from "./about-form";
import { ContactSectionForm } from "./contact-form";
import { HouseholdSectionForm } from "./household-form";
import { MembershipSectionForm } from "./membership-form";
import { ServiceSectionForm } from "./service-form";
import { NextOfKinSectionForm } from "./next-of-kin-form";
import { ConsentSectionForm } from "./consent-form";
import { FaceSectionForm } from "./face-form";

type HouseholdMemberWithLink = HouseholdMember & {
  linkedMember: Pick<Member, "id" | "memberNumber" | "surname" | "firstName" | "fullNameAsWritten"> | null;
};

type MemberWithRelations = Member & {
  wing: Wing;
  household: HouseholdMemberWithLink[];
  serviceAreas: Array<{ serviceAreaId: string }>;
};

export default async function RecordSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: sectionKey } = await params;
  const definition = findRecordSection(sectionKey);
  if (!definition) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user.memberId) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  const member = await prisma.member.findUnique({
    where: { id: user.memberId },
    include: {
      wing: true,
      household: { include: { linkedMember: true } },
      serviceAreas: { select: { serviceAreaId: true } },
    },
  });
  if (!member) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  const branches = sectionKey === "membership" ? await prisma.branch.findMany({ orderBy: { name: "asc" } }) : [];
  const serviceAreas =
    sectionKey === "service"
      ? await prisma.serviceArea.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">
          {definition.order} of {RECORD_SECTIONS.length}
        </p>
        <h1 className="text-xl font-semibold text-navy-900">{definition.label}</h1>
      </div>

      <SectionBody sectionKey={definition.key} member={member} branches={branches} serviceAreas={serviceAreas} />
    </div>
  );
}

function SectionBody({
  sectionKey,
  member,
  branches,
  serviceAreas,
}: {
  sectionKey: string;
  member: MemberWithRelations;
  branches: Branch[];
  serviceAreas: ServiceArea[];
}) {
  switch (sectionKey) {
    case "name":
      return (
        <NameSectionForm
          fullNameAsWritten={member.fullNameAsWritten}
          title={member.title}
          surname={member.surname}
          firstName={member.firstName}
          otherNames={member.otherNames}
        />
      );
    case "about":
      return (
        <AboutSectionForm
          dateOfBirth={member.dateOfBirth}
          gender={member.gender}
          maritalStatus={member.maritalStatus}
          occupation={member.occupation}
          nationality={member.nationality}
          stateOfOrigin={member.stateOfOrigin}
          languages={member.languages}
        />
      );
    case "contact":
      return (
        <ContactSectionForm
          phone={member.phone}
          altPhone={member.altPhone}
          email={member.email}
          address={member.address}
          city={member.city}
          state={member.state}
          landmark={member.landmark}
          preferredContact={member.preferredContact}
        />
      );
    case "household":
      return <HouseholdSectionForm household={member.household} />;
    case "membership":
      return (
        <MembershipSectionForm
          wingName={member.wing.name}
          status={member.status}
          memberNumber={member.memberNumber}
          officeHeld={member.officeHeld}
          yearJoined={member.yearJoined}
          branchId={member.branchId}
          halaqah={member.halaqah}
          branches={branches}
        />
      );
    case "service":
      return (
        <ServiceSectionForm
          islamicEducation={member.islamicEducation}
          otherSkills={member.otherSkills}
          availability={member.availability}
          serviceAreas={serviceAreas}
          selectedServiceAreaIds={new Set(member.serviceAreas.map((row) => row.serviceAreaId))}
        />
      );
    case "next-of-kin":
      return (
        <NextOfKinSectionForm
          nokName={member.nokName}
          nokRelationship={member.nokRelationship}
          nokPhone={member.nokPhone}
          nokAltPhone={member.nokAltPhone}
        />
      );
    case "consent":
      return (
        <ConsentSectionForm
          consentRecords={member.consentRecords}
          consentDirectory={member.consentDirectory}
          consentComms={member.consentComms}
        />
      );
    case "face":
      // Excluded after a face match review: the section is done and
      // nothing is asked of the member (MEMBER-HOME-AND-ADMIN-VIEW.md 3.5).
      if (member.faceCheckInExcluded) {
        return (
          <p className="text-base text-muted-foreground">
            You are checked in by name at every gathering. There is nothing you need to do in this section.
          </p>
        );
      }
      return <FaceSectionForm consentBiometric={member.consentBiometric} />;
    default:
      // Unreachable: findRecordSection only resolves the nine keys
      // above, and every one of them has a case here.
      throw new Error(`No form wired up for record section "${sectionKey}"`);
  }
}
