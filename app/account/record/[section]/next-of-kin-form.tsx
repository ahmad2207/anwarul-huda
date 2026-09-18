"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNextOfKinSection } from "./actions";

export function NextOfKinSectionForm({
  nokName,
  nokRelationship,
  nokPhone,
  nokAltPhone,
}: {
  nokName: string | null;
  nokRelationship: string | null;
  nokPhone: string | null;
  nokAltPhone: string | null;
}) {
  const [error, formAction, isPending] = useActionState(saveNextOfKinSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nokName">Name</Label>
        <Input id="nokName" name="nokName" defaultValue={nokName ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nokRelationship">Relationship</Label>
        <Input
          id="nokRelationship"
          name="nokRelationship"
          defaultValue={nokRelationship ?? ""}
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nokPhone">Phone</Label>
        <Input id="nokPhone" name="nokPhone" type="tel" defaultValue={nokPhone ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nokAltPhone">Alternative phone</Label>
        <Input
          id="nokAltPhone"
          name="nokAltPhone"
          type="tel"
          defaultValue={nokAltPhone ?? ""}
          className="h-11 text-base"
        />
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
