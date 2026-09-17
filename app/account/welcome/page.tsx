import Link from "next/link";
import { Button } from "@/components/ui/button";

// MEMBER-INTERFACE.md 3.6: reached exactly once, right after the forced
// password change on a member's very first login (see the redirect in
// app/change-password/actions.ts), never on a voluntary later change.
// Shown inside the normal member shell, bottom nav included, rather than
// a bare screen outside it: unlike /change-password, nothing here needs
// to worry about being redirected back to itself, so there is no reason
// to hide the chrome a member is about to start using.
export default function AccountWelcomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy-900">Assalamu alaikum, and welcome</h1>

      <div className="flex flex-col gap-3 text-base text-muted-foreground">
        <p>
          This is your own account with the league: your record, your payments, and the sermons and
          books the league shares.
        </p>
        <p>
          Your record needs completing. Only you know how your name should be split, whether your
          contact details are right, and who to list as next of kin, so the next few screens ask you
          for that, one short section at a time. You can stop and come back whenever you like.
        </p>
        <p>Only the office can see what you enter.</p>
      </div>

      <Button
        render={<Link href="/account/record">Get started</Link>}
        className="h-11 self-start rounded-[4px] px-6 text-base"
      />
    </div>
  );
}
