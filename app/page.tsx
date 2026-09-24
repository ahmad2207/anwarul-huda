import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static asset, not one next/image needs to optimise */}
      <img src="/logo.png" alt="Anwaru-l-Huda League of Nigeria" width={96} height={96} />
      <h1 className="text-2xl font-semibold">Anwaru-l-Huda League of Nigeria</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Membership and administration system.
      </p>
      <div className="flex gap-3">
        <Button render={<Link href="/register">Register</Link>} variant="outline" />
        <Button render={<Link href="/login">Sign in</Link>} />
      </div>
    </div>
  );
}
