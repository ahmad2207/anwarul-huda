"use client";

import { Field, FormError, SectionActions, SelectField } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
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
  const { state: error, formAction, isPending, value } = useRememberedForm(saveContactSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* MEMBER-INTERFACE.md 3.4: not "required field", the actual reason. */}
      <Field
        label="Phone"
        id="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={value("phone", phone ?? "")}
        hint="This is how you reset your own password if you forget it, and how the office reaches you."
      />
      <Field label="Alternative phone" id="altPhone" type="tel" defaultValue={value("altPhone", altPhone ?? "")} />
      <Field label="Email" id="email" type="email" autoComplete="email" defaultValue={value("email", email ?? "")} />
      <Field label="Address" id="address" autoComplete="street-address" defaultValue={value("address", address ?? "")} />
      <Field label="City" id="city" defaultValue={value("city", city ?? "")} />
      <Field label="State" id="state" defaultValue={value("state", state ?? "")} />
      <Field label="Nearest landmark" id="landmark" defaultValue={value("landmark", landmark ?? "")} />
      <SelectField
        label="Preferred contact"
        id="preferredContact"
        placeholder="Not stated"
        defaultValue={value("preferredContact", preferredContact ?? "")}
        options={[
          { value: "PHONE_CALL", label: "Phone call" },
          { value: "SMS", label: "SMS" },
          { value: "WHATSAPP", label: "WhatsApp" },
          { value: "EMAIL", label: "Email" },
        ]}
      />

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}
