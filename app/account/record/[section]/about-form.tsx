"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAboutSection } from "./actions";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function AboutSectionForm({
  dateOfBirth,
  gender,
  maritalStatus,
  occupation,
  nationality,
  stateOfOrigin,
  languages,
}: {
  dateOfBirth: Date | null;
  gender: string;
  maritalStatus: string | null;
  occupation: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  languages: string[];
}) {
  const [error, formAction, isPending] = useActionState(saveAboutSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={toDateInputValue(dateOfBirth)}
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gender">Gender</Label>
        <select
          id="gender"
          name="gender"
          defaultValue={gender}
          required
          className="h-11 rounded-[4px] border border-input bg-background px-3 text-base"
        >
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="maritalStatus">Marital status</Label>
        <select
          id="maritalStatus"
          name="maritalStatus"
          defaultValue={maritalStatus ?? ""}
          className="h-11 rounded-[4px] border border-input bg-background px-3 text-base"
        >
          <option value="">Not stated</option>
          <option value="SINGLE">Single</option>
          <option value="MARRIED">Married</option>
          <option value="DIVORCED">Divorced</option>
          <option value="WIDOWED">Widowed</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="occupation">Occupation</Label>
        <Input id="occupation" name="occupation" defaultValue={occupation ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Input id="nationality" name="nationality" defaultValue={nationality ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stateOfOrigin">State of origin</Label>
        <Input id="stateOfOrigin" name="stateOfOrigin" defaultValue={stateOfOrigin ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="languages">Languages spoken</Label>
        <Input
          id="languages"
          name="languages"
          defaultValue={languages.join(", ")}
          placeholder="Yoruba, English"
          className="h-11 text-base"
        />
        <p className="text-sm text-muted-foreground">Separate more than one with a comma.</p>
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
