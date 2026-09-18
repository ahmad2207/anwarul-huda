import { SignOutButton } from "@/components/sign-out-button";
import { SettingsPasswordForm } from "./settings-password-form";

// MEMBER-INTERFACE.md 3.1 names this route "Password, phone,
// notification preferences". Only password and sign out exist to build
// today: phone belongs to section 3 of the record itself (M3), and
// notification preferences are not a feature yet. Both can gain a
// section here once they exist, rather than this page inventing
// somewhere else for them to live meanwhile.
export default function AccountSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy-900">Settings</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-medium">Password</h2>
        <SettingsPasswordForm />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-base font-medium">Account</h2>
        <SignOutButton className="w-full max-w-xs" />
      </section>
    </div>
  );
}
