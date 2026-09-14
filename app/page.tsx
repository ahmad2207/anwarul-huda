import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Anwar-ul-Huda League of Nigeria</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Membership and administration system. This is the Phase 0 foundation.
        Feature pages have not been built yet.
      </p>
      <Button render={<Link href="/login">Sign in</Link>} />
    </div>
  );
}
