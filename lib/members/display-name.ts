// Every path into the member register except a nominal roll import still
// requires surname and firstName (see prisma/schema.prisma's note on
// Member), so this is the one place that copes with the exception rather
// than every screen that displays a member's name doing it separately.

export interface NameParts {
  surname: string | null;
  firstName: string | null;
  fullNameAsWritten?: string | null;
}

/**
 * The name to show for a member: surname and first name when both are
 * known, otherwise the name exactly as it appeared on the source roll, or
 * finally a plain placeholder if somehow neither exists. Never silently
 * renders "null" for a missing part.
 */
export function formatMemberName(member: NameParts): string {
  if (member.surname && member.firstName) {
    return `${member.surname} ${member.firstName}`;
  }
  if (member.fullNameAsWritten) {
    return member.fullNameAsWritten;
  }
  return member.surname || member.firstName || "Name not on file";
}

/**
 * A single given name to greet a member by ("Assalamu alaikum, Musa"),
 * for a member area home screen that has to work for someone whose
 * record is still incomplete, not only someone with a proper firstName
 * on file. Falls back to the first word of the roll's own name, and
 * finally to nothing at all: a greeting with no name is still a
 * greeting, never "Assalamu alaikum, Name not on file".
 */
export function firstNameForGreeting(member: NameParts): string | null {
  if (member.firstName) {
    return member.firstName;
  }
  if (member.fullNameAsWritten) {
    return member.fullNameAsWritten.trim().split(/\s+/)[0] || null;
  }
  return null;
}
