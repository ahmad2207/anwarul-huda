import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AccountHomePage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-muted-foreground">Welcome to your member account.</p>
      <Button
        render={<Link href="/account/contributions">My contributions</Link>}
        className="h-11 self-start px-5 text-base"
      />
      <Button render={<Link href="/library">Library</Link>} className="h-11 self-start px-5 text-base" />
    </div>
  );
}
