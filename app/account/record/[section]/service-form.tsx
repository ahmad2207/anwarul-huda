"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ServiceArea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveServiceSection } from "./actions";

export function ServiceSectionForm({
  islamicEducation,
  otherSkills,
  availability,
  serviceAreas,
  selectedServiceAreaIds,
}: {
  islamicEducation: string | null;
  otherSkills: string | null;
  availability: string[];
  serviceAreas: ServiceArea[];
  selectedServiceAreaIds: Set<string>;
}) {
  const [error, formAction, isPending] = useActionState(saveServiceSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="islamicEducation">Islamic education or qualifications</Label>
        <Input
          id="islamicEducation"
          name="islamicEducation"
          defaultValue={islamicEducation ?? ""}
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="otherSkills">Other skills</Label>
        <Input id="otherSkills" name="otherSkills" defaultValue={otherSkills ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="availability">General availability</Label>
        <Input
          id="availability"
          name="availability"
          defaultValue={availability.join(", ")}
          placeholder="Weekday evenings, Sunday"
          className="h-11 text-base"
        />
        <p className="text-sm text-muted-foreground">Separate more than one with a comma.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-base font-medium">Areas of service</span>
        <div className="flex flex-col gap-2">
          {serviceAreas.map((area) => (
            <label key={area.id} className="flex items-center gap-3 text-base">
              <input
                type="checkbox"
                name="serviceAreaIds"
                value={area.id}
                defaultChecked={selectedServiceAreaIds.has(area.id)}
                className="size-5"
              />
              {area.name}
            </label>
          ))}
        </div>
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
