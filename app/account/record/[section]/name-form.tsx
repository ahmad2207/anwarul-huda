"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNameSection } from "./actions";

export function NameSectionForm({
  fullNameAsWritten,
  title,
  surname,
  firstName,
  otherNames,
}: {
  fullNameAsWritten: string | null;
  title: string | null;
  surname: string | null;
  firstName: string | null;
  otherNames: string | null;
}) {
  const [error, formAction, isPending] = useActionState(saveNameSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {fullNameAsWritten ? (
        <div className="flex flex-col gap-2">
          <p className="text-base text-muted-foreground">On our records you appear as:</p>
          <p className="rounded-[4px] border border-border bg-paper-dim p-3 font-medium">{fullNameAsWritten}</p>
          <p className="text-base text-muted-foreground">
            Our old register wrote names in different orders, so we need you to tell us which part is which.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={title ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="surname">Surname</Label>
        <Input id="surname" name="surname" defaultValue={surname ?? ""} required className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">First name</Label>
        <Input id="firstName" name="firstName" defaultValue={firstName ?? ""} required className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="otherNames">Other names</Label>
        <Input id="otherNames" name="otherNames" defaultValue={otherNames ?? ""} className="h-11 text-base" />
      </div>

      {error ? <p className="text-base text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="h-11 rounded-[4px] px-6 text-base">
          {isPending ? "Saving..." : "Save and continue"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          render={<Link href="/account/record">Cancel</Link>}
          className="h-11 rounded-[4px] px-6 text-base"
        />
      </div>
    </form>
  );
}
