"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveContactSection } from "./actions";

export function ContactSectionForm({
  phone,
  altPhone,
  email,
  address,
  city,
  state,
  landmark,
  preferredContact,
}: {
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  landmark: string | null;
  preferredContact: string | null;
}) {
  const [error, formAction, isPending] = useActionState(saveContactSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} className="h-11 text-base" />
        {/* MEMBER-INTERFACE.md 3.4: not "required field", the actual reason. */}
        <p className="text-base text-muted-foreground">
          This is how you reset your own password if you forget it, and how the office reaches you.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="altPhone">Alternative phone</Label>
        <Input id="altPhone" name="altPhone" type="tel" defaultValue={altPhone ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={email ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={address ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" defaultValue={city ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="state">State</Label>
        <Input id="state" name="state" defaultValue={state ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="landmark">Nearest landmark</Label>
        <Input id="landmark" name="landmark" defaultValue={landmark ?? ""} className="h-11 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="preferredContact">Preferred contact</Label>
        <select
          id="preferredContact"
          name="preferredContact"
          defaultValue={preferredContact ?? ""}
          className="h-11 rounded-[4px] border border-input bg-background px-3 text-base"
        >
          <option value="">Not stated</option>
          <option value="PHONE_CALL">Phone call</option>
          <option value="SMS">SMS</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">Email</option>
        </select>
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
