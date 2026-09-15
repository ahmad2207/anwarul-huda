import { MemberShell } from "@/components/member-shell";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
