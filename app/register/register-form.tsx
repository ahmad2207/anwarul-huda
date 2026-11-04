"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Branch, ServiceArea, Wing } from "@prisma/client";
import { CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import {
  CheckboxRow,
  Field,
  FieldGroup,
  FormError,
  SelectField,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/member/form";
import { PublicCard } from "@/components/member/public-frame";
import { submitRegistration, type RegistrationState } from "./actions";

interface HouseholdRow {
  fullName: string;
  age: string;
  relationship: string;
}

// Single column and one section at a time down the page, built for a
// phone first: a dense three column grid of thirty small inputs is what
// a person gives up on halfway. Everything typed survives a server
// error (the action sends the values back, see RegistrationState).
export function RegisterForm({
  wings,
  branches,
  serviceAreas,
}: {
  wings: Wing[];
  branches: Branch[];
  serviceAreas: ServiceArea[];
}) {
  const [state, formAction, isPending] = useActionState(submitRegistration, {} as RegistrationState);
  const [household, setHousehold] = useState<HouseholdRow[]>([]);

  if (state.success) {
    return (
      <PublicCard title={`Thank you${state.firstName ? `, ${state.firstName}` : ""}`}>
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-3 rounded-[14px] bg-sabon-soft p-4 text-base text-sabon">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            Your registration has been received.
          </p>
          <p className="text-base text-ink-2">
            A wing administrator will review it, and you will be able to sign in once it is approved.
          </p>
          <Link href="/" className={`${secondaryButtonClass} self-start`}>
            Back to the start
          </Link>
        </div>
      </PublicCard>
    );
  }

  const submitted = state.values;
  function value(name: string): string {
    const entry = submitted?.[name];
    return typeof entry === "string" ? entry : "";
  }
  function isChecked(name: string): boolean {
    return submitted ? name in submitted : false;
  }
  const chosenServiceAreas = new Set(
    Array.isArray(submitted?.serviceAreaIds)
      ? submitted.serviceAreaIds
      : typeof submitted?.serviceAreaIds === "string"
        ? [submitted.serviceAreaIds]
        : [],
  );

  function addHouseholdRow() {
    setHousehold((rows) => [...rows, { fullName: "", age: "", relationship: "" }]);
  }

  function removeHouseholdRow(index: number) {
    setHousehold((rows) => rows.filter((_, i) => i !== index));
  }

  function updateHouseholdRow(index: number, field: keyof HouseholdRow, fieldValue: string) {
    setHousehold((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("household", JSON.stringify(household));
    return formAction(formData);
  }

  return (
    <div className="flex flex-col gap-5">
      <PublicCard
        title="Become a member"
        lead="Fill in as much as you can. Only the fields marked required are needed today, and a wing administrator reviews every registration before it is approved."
      >
        <p className="text-base text-ink-2">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-navy-700 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </PublicCard>

      <form action={handleSubmit} className="flex flex-col gap-5">

        <FieldGroup title="About you">
          <Field label="Title" id="title" placeholder="For example Mallam, Alhaja" defaultValue={value("title")} />
          <Field label="Surname" id="surname" required autoComplete="family-name" defaultValue={value("surname")} />
          <Field label="First name" id="firstName" required autoComplete="given-name" defaultValue={value("firstName")} />
          <Field label="Other names" id="otherNames" autoComplete="additional-name" defaultValue={value("otherNames")} />
          <Field label="Date of birth" id="dateOfBirth" type="date" autoComplete="bday" defaultValue={value("dateOfBirth")} />
          <SelectField
            label="Gender"
            id="gender"
            required
            placeholder="Choose one"
            defaultValue={value("gender")}
            options={[
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
            ]}
          />
          <SelectField
            label="Marital status"
            id="maritalStatus"
            placeholder="Not stated"
            defaultValue={value("maritalStatus")}
            options={[
              { value: "SINGLE", label: "Single" },
              { value: "MARRIED", label: "Married" },
              { value: "DIVORCED", label: "Divorced" },
              { value: "WIDOWED", label: "Widowed" },
            ]}
          />
          <Field label="Occupation" id="occupation" defaultValue={value("occupation")} />
          <Field label="Nationality" id="nationality" defaultValue={value("nationality")} />
          <Field label="State of origin" id="stateOfOrigin" defaultValue={value("stateOfOrigin")} />
          <Field
            label="Languages spoken"
            id="languages"
            placeholder="Hausa, English"
            hint="Separate more than one with a comma."
            defaultValue={value("languages")}
          />
        </FieldGroup>

        <FieldGroup title="Contact details">
          <Field
            label="Phone"
            id="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            hint="You will sign in with this, and the office uses it to reach you."
            defaultValue={value("phone")}
          />
          <Field label="Alternative phone" id="altPhone" type="tel" inputMode="tel" defaultValue={value("altPhone")} />
          <Field label="Email" id="email" type="email" autoComplete="email" defaultValue={value("email")} />
          <Field label="Address" id="address" autoComplete="street-address" defaultValue={value("address")} />
          <Field label="City" id="city" defaultValue={value("city")} />
          <Field label="State" id="state" defaultValue={value("state")} />
          <Field label="Nearest landmark" id="landmark" defaultValue={value("landmark")} />
          <SelectField
            label="Preferred contact"
            id="preferredContact"
            placeholder="Not stated"
            defaultValue={value("preferredContact")}
            options={[
              { value: "PHONE_CALL", label: "Phone call" },
              { value: "SMS", label: "SMS" },
              { value: "WHATSAPP", label: "WhatsApp" },
              { value: "EMAIL", label: "Email" },
            ]}
          />
        </FieldGroup>

        <FieldGroup title="Your membership">
          <SelectField
            label="Wing"
            id="wingId"
            required
            placeholder="Choose one"
            defaultValue={value("wingId")}
            options={wings.map((wing) => ({ value: wing.id, label: wing.name }))}
          />
          <SelectField
            label="Masjid or branch"
            id="branchId"
            placeholder="Not stated"
            defaultValue={value("branchId")}
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </FieldGroup>

        <FieldGroup title="Service and skills">
          <Field
            label="Islamic education or qualifications"
            id="islamicEducation"
            defaultValue={value("islamicEducation")}
          />
          <Field label="Other skills" id="otherSkills" defaultValue={value("otherSkills")} />
          <Field
            label="General availability"
            id="availability"
            placeholder="Weekday evenings, Sunday"
            hint="Separate more than one with a comma."
            defaultValue={value("availability")}
          />
          <Field label="Access needs" id="accessNeeds" defaultValue={value("accessNeeds")} />
          {serviceAreas.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-base font-medium">Areas of service</legend>
              {serviceAreas.map((area) => (
                <CheckboxRow
                  key={area.id}
                  name="serviceAreaIds"
                  value={area.id}
                  defaultChecked={chosenServiceAreas.has(area.id)}
                >
                  {area.name}
                </CheckboxRow>
              ))}
            </fieldset>
          ) : null}
        </FieldGroup>

        <FieldGroup title="Household" description="Spouse or spouses, children and others who live with you.">
          {household.map((row, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-[14px] bg-paper-dim/60 p-4">
              <p className="text-base font-semibold">Person {index + 1}</p>
              <HouseholdInput
                id={`household-${index}-fullName`}
                label="Full name"
                value={row.fullName}
                onChange={(next) => updateHouseholdRow(index, "fullName", next)}
              />
              <HouseholdInput
                id={`household-${index}-age`}
                label="Age"
                type="number"
                value={row.age}
                onChange={(next) => updateHouseholdRow(index, "age", next)}
              />
              <HouseholdInput
                id={`household-${index}-relationship`}
                label="Relationship"
                value={row.relationship}
                onChange={(next) => updateHouseholdRow(index, "relationship", next)}
              />
              <button
                type="button"
                className="inline-flex h-11 items-center gap-1.5 self-start rounded-[14px] px-3 text-base font-medium text-alert hover:bg-alert-soft"
                onClick={() => removeHouseholdRow(index)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove person {index + 1}
              </button>
            </div>
          ))}
          <button type="button" className={`${secondaryButtonClass} self-start`} onClick={addHouseholdRow}>
            <UserPlus className="size-5" aria-hidden="true" />
            Add household member
          </button>
        </FieldGroup>

        <FieldGroup title="Next of kin">
          <Field label="Name" id="nokName" defaultValue={value("nokName")} />
          <Field label="Relationship" id="nokRelationship" defaultValue={value("nokRelationship")} />
          <Field label="Phone" id="nokPhone" type="tel" inputMode="tel" defaultValue={value("nokPhone")} />
          <Field label="Alternative phone" id="nokAltPhone" type="tel" inputMode="tel" defaultValue={value("nokAltPhone")} />
        </FieldGroup>

        <FieldGroup title="Consent">
          <CheckboxRow name="consentRecords" required defaultChecked={isChecked("consentRecords")}>
            I consent to my record being kept (required)
          </CheckboxRow>
          <CheckboxRow name="consentDirectory" defaultChecked={isChecked("consentDirectory")}>
            I consent to being listed in the members directory
          </CheckboxRow>
          <CheckboxRow name="consentComms" defaultChecked={isChecked("consentComms")}>
            I consent to receiving communications
          </CheckboxRow>
          <CheckboxRow name="consentBiometric" defaultChecked={isChecked("consentBiometric")}>
            I consent to face check-in at gatherings. If I do not, I will be checked in by name.
          </CheckboxRow>
        </FieldGroup>

        <FieldGroup
          title="Choose a password"
          description="You will use this, with your phone number or email, to sign in once your registration is approved."
        >
          <Field
            label="Password"
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters, and not one of the passwords everyone tries first.`}
          />
          <Field
            label="Confirm password"
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </FieldGroup>

        <FormError>{state.error}</FormError>

        <button type="submit" disabled={isPending} className={`${primaryButtonClass} w-full`}>
          {isPending ? "Sending your registration..." : "Send registration"}
        </button>
      </form>
    </div>
  );
}

function HouseholdInput({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}
