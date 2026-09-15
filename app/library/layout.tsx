import { MemberShell } from "@/components/member-shell";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
