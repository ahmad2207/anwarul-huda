"use client";

import { useActionState, useRef, useState } from "react";
import type { Branch, ServiceArea, Wing } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { submitRegistration } from "./actions";

interface HouseholdRow {
  fullName: string;
  age: string;
  relationship: string;
}

export function RegisterForm({
  wings,
  branches,
  serviceAreas,
}: {
  wings: Wing[];
  branches: Branch[];
  serviceAreas: ServiceArea[];
}) {
  const [state, formAction, isPending] = useActionState(submitRegistration, {});
  const [household, setHousehold] = useState<HouseholdRow[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  if (state.success) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Thank you{state.firstName ? `, ${state.firstName}` : ""}</CardTitle>
          <CardDescription>
            Your registration has been received. A wing administrator will review it, and you
            will be able to sign in once it is approved.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function addHouseholdRow() {
    setHousehold((rows) => [...rows, { fullName: "", age: "", relationship: "" }]);
  }

  function removeHouseholdRow(index: number) {
    setHousehold((rows) => rows.filter((_, i) => i !== index));
  }

  function updateHouseholdRow(index: number, field: keyof HouseholdRow, value: string) {
    setHousehold((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("household", JSON.stringify(household));
    return formAction(formData);
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Membership registration</CardTitle>
        <CardDescription>
          Fill in as much as you can. A wing administrator reviews every registration before it is
          approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-6">
          {state.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-sm font-medium">Identity</legend>
            <Field label="Title" name="title" />
            <Field label="Surname" name="surname" required />
            <Field label="First name" name="firstName" required />
            <Field label="Other names" name="otherNames" />
            <Field label="Date of birth" name="dateOfBirth" type="date" />
            <SelectField label="Gender" name="gender" required options={[
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
            ]} />
            <SelectField label="Marital status" name="maritalStatus" options={[
              { value: "SINGLE", label: "Single" },
              { value: "MARRIED", label: "Married" },
              { value: "DIVORCED", label: "Divorced" },
              { value: "WIDOWED", label: "Widowed" },
            ]} />
            <Field label="Occupation" name="occupation" />
            <Field label="Nationality" name="nationality" />
            <Field label="State of origin" name="stateOfOrigin" />
            <Field label="Languages spoken (comma separated)" name="languages" className="sm:col-span-2" />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-sm font-medium">Contact</legend>
            <Field label="Phone" name="phone" required />
            <Field label="Alternative phone" name="altPhone" />
            <Field label="Email" name="email" type="email" />
            <Field label="Address" name="address" className="sm:col-span-2" />
            <Field label="City" name="city" />
            <Field label="State" name="state" />
            <Field label="Nearest landmark" name="landmark" />
            <SelectField label="Preferred contact" name="preferredContact" options={[
              { value: "PHONE_CALL", label: "Phone call" },
              { value: "SMS", label: "SMS" },
              { value: "WHATSAPP", label: "WhatsApp" },
              { value: "EMAIL", label: "Email" },
            ]} />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-sm font-medium">Membership</legend>
            <SelectField
              label="Wing"
              name="wingId"
              required
              options={wings.map((wing) => ({ value: wing.id, label: wing.name }))}
            />
            <SelectField
              label="Masjid or branch"
              name="branchId"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Service and skills</legend>
            <Field label="Islamic education or qualifications" name="islamicEducation" />
            <Field label="Other skills" name="otherSkills" />
            <Field label="General availability (comma separated)" name="availability" />
            <Field label="Access needs" name="accessNeeds" />
            <div className="col-span-full flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Areas of service</span>
              <div className="flex flex-wrap gap-3">
                {serviceAreas.map((area) => (
                  <label key={area.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="serviceAreaIds" value={area.id} />
                    {area.name}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">Household</legend>
            <p className="text-xs text-muted-foreground">
              Spouse or spouses, children and others who live with you.
            </p>
            {household.map((row, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`household-${index}-fullName`} className="text-xs">
                    Full name
                  </Label>
                  <Input
                    id={`household-${index}-fullName`}
                    value={row.fullName}
                    onChange={(e) => updateHouseholdRow(index, "fullName", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`household-${index}-age`} className="text-xs">
                    Age
                  </Label>
                  <Input
                    id={`household-${index}-age`}
                    type="number"
                    className="w-20"
                    value={row.age}
                    onChange={(e) => updateHouseholdRow(index, "age", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`household-${index}-relationship`} className="text-xs">
                    Relationship
                  </Label>
                  <Input
                    id={`household-${index}-relationship`}
                    value={row.relationship}
                    onChange={(e) => updateHouseholdRow(index, "relationship", e.target.value)}
                  />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeHouseholdRow(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={addHouseholdRow}>
              Add household member
            </Button>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Next of kin</legend>
            <Field label="Name" name="nokName" />
            <Field label="Relationship" name="nokRelationship" />
            <Field label="Phone" name="nokPhone" />
            <Field label="Alternative phone" name="nokAltPhone" />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Consent</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentRecords" required />
              I consent to my record being kept (required)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentDirectory" />
              I consent to being listed in the members directory
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentComms" />
              I consent to receiving communications
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="consentBiometric" />
              I consent to biometric enrolment for attendance (you can decline and use a QR card instead)
            </label>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Choose a password</legend>
            <Field label="Password" name="password" type="password" required />
            <Field label="Confirm password" name="confirmPassword" type="password" required />
            <p className="col-span-full text-xs text-muted-foreground">
              You will use this, with your phone number or email, to sign in once your registration
              is approved.
            </p>
          </fieldset>

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registering..." : "Register"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="" disabled={required}>
          {required ? "Choose..." : "Not stated"}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
