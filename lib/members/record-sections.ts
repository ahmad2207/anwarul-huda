import { RecordSection } from "@prisma/client";

/**
 * The nine sections of the Member Information Form, in the order
 * MEMBER-INTERFACE.md 3.4 lists them. `key` is the URL slug used under
 * /account/record; `section` is the database value a completed section
 * is recorded under, on Member.completedSections.
 *
 * `isBuilt` is true only for the sections that have a real form today.
 * M3 is built one prompt at a time (section 1 and section 9 first, the
 * rest to follow); the contents view still lists every section so a
 * member always sees the whole form, but only links to the ones that
 * actually open.
 */
export interface RecordSectionDefinition {
  key: string;
  section: RecordSection;
  order: number;
  label: string;
  isBuilt: boolean;
}

export const RECORD_SECTIONS: readonly RecordSectionDefinition[] = [
  { key: "name", section: "NAME", order: 1, label: "Your name", isBuilt: true },
  { key: "about", section: "ABOUT", order: 2, label: "About you", isBuilt: true },
  { key: "contact", section: "CONTACT", order: 3, label: "Contact details", isBuilt: true },
  { key: "household", section: "HOUSEHOLD", order: 4, label: "Household", isBuilt: true },
  { key: "membership", section: "MEMBERSHIP", order: 5, label: "Your membership", isBuilt: true },
  { key: "service", section: "SERVICE", order: 6, label: "Service and skills", isBuilt: true },
  { key: "next-of-kin", section: "NEXT_OF_KIN", order: 7, label: "Next of kin", isBuilt: true },
  { key: "consent", section: "CONSENT", order: 8, label: "Consent", isBuilt: true },
  { key: "face", section: "FACE", order: 9, label: "Face check-in", isBuilt: true },
];

export function findRecordSection(key: string): RecordSectionDefinition | undefined {
  return RECORD_SECTIONS.find((definition) => definition.key === key);
}

export interface RecordProgress {
  completedCount: number;
  total: number;
  /** The first section, in order, the member has not yet completed. Null once every section is done. */
  nextSection: RecordSectionDefinition | null;
  isComplete: boolean;
}

/**
 * The real "N of 9" for the home screen and the contents view, computed
 * from what the member has actually saved rather than assumed. A
 * section counts once its RecordSection value appears in
 * completedSections; MEMBER-INTERFACE.md 3.4 requires section 9 to
 * carry either a completed enrolment or a deferral before it counts,
 * never a visit alone.
 */
export function recordProgress(completedSections: RecordSection[]): RecordProgress {
  const completedCount = RECORD_SECTIONS.filter((definition) =>
    completedSections.includes(definition.section),
  ).length;
  const nextSection =
    RECORD_SECTIONS.find((definition) => !completedSections.includes(definition.section)) ?? null;

  return {
    completedCount,
    total: RECORD_SECTIONS.length,
    nextSection,
    isComplete: completedCount === RECORD_SECTIONS.length,
  };
}
