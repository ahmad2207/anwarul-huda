import { SignOutButton } from "@/components/sign-out-button";
import { PageTitle, SectionHeading, MemberCard } from "@/components/member/card";
import { SettingsPasswordForm } from "./settings-password-form";

// MEMBER-INTERFACE.md 3.1 names this route "Password, phone,
// notification preferences". Only password and sign out exist to build
// today: phone belongs to section 3 of the record itself (M3), and
// notification preferences are not a feature yet.
export default function AccountSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Settings</PageTitle>

      <MemberCard as="section" className="flex flex-col gap-4">
        <SectionHeading>Password</SectionHeading>
        <SettingsPasswordForm />
      </MemberCard>

      <MemberCard as="section" className="flex flex-col gap-3">
        <SectionHeading>Account</SectionHeading>
        <p className="text-base text-ink-2">Sign out when you are using a phone or computer that is not your own.</p>
        <SignOutButton appearance="member" className="sm:max-w-xs" />
      </MemberCard>
    </div>
  );
}
