"use client";

import { useActionState } from "react";
import type { Branch, Member, ServiceArea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMember } from "./actions";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function EditMemberForm({
  member,
  branches,
  serviceAreas,
}: {
  member: Member & { serviceAreas: Array<{ serviceAreaId: string }> };
  branches: Branch[];
  serviceAreas: ServiceArea[];
}) {
  const boundAction = updateMember.bind(null, member.id);
  const [state, formAction, isPending] = useActionState(boundAction, {});
  const selectedServiceAreaIds = new Set(member.serviceAreas.map((entry) => entry.serviceAreaId));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Identity</legend>
        <Field label="Title" name="title" defaultValue={member.title ?? ""} />
        <Field label="Surname" name="surname" defaultValue={member.surname ?? ""} required />
        <Field label="First name" name="firstName" defaultValue={member.firstName ?? ""} required />
        <Field label="Other names" name="otherNames" defaultValue={member.otherNames ?? ""} />
        <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={toDateInputValue(member.dateOfBirth)} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="gender" className="text-xs">Gender</Label>
          <select id="gender" name="gender" defaultValue={member.gender} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="maritalStatus" className="text-xs">Marital status</Label>
          <select id="maritalStatus" name="maritalStatus" defaultValue={member.maritalStatus ?? ""} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Not stated</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
            <option value="DIVORCED">Divorced</option>
            <option value="WIDOWED">Widowed</option>
          </select>
        </div>
        <Field label="Occupation" name="occupation" defaultValue={member.occupation ?? ""} />
        <Field label="Nationality" name="nationality" defaultValue={member.nationality ?? ""} />
        <Field label="State of origin" name="stateOfOrigin" defaultValue={member.stateOfOrigin ?? ""} />
        <Field
          label="Languages (comma separated)"
          name="languages"
          defaultValue={member.languages.join(", ")}
          className="sm:col-span-2"
        />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Contact</legend>
        <Field label="Phone" name="phone" defaultValue={member.phone ?? ""} required />
        <Field label="Alternative phone" name="altPhone" defaultValue={member.altPhone ?? ""} />
        <Field label="Email" name="email" type="email" defaultValue={member.email ?? ""} />
        <Field label="Address" name="address" defaultValue={member.address ?? ""} className="sm:col-span-2" />
        <Field label="City" name="city" defaultValue={member.city ?? ""} />
        <Field label="State" name="state" defaultValue={member.state ?? ""} />
        <Field label="Nearest landmark" name="landmark" defaultValue={member.landmark ?? ""} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="preferredContact" className="text-xs">Preferred contact</Label>
          <select id="preferredContact" name="preferredContact" defaultValue={member.preferredContact ?? ""} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Not stated</option>
            <option value="PHONE_CALL">Phone call</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Membership</legend>
        <div className="flex flex-col gap-1">
          <Label htmlFor="branchId" className="text-xs">Branch</Label>
          <select id="branchId" name="branchId" defaultValue={member.branchId ?? ""} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Not assigned</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </div>
        <Field label="Year joined" name="yearJoined" type="number" defaultValue={member.yearJoined?.toString() ?? ""} />
        <Field label="Office held" name="officeHeld" defaultValue={member.officeHeld ?? ""} />
        <Field label="Halaqah or usrah group" name="halaqah" defaultValue={member.halaqah ?? ""} />
        <p className="col-span-full text-xs text-muted-foreground">
          Wing is not editable here. A wing transfer is a committee decision, not yet built as a workflow.
        </p>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Service and skills</legend>
        <Field label="Islamic education or qualifications" name="islamicEducation" defaultValue={member.islamicEducation ?? ""} />
        <Field label="Other skills" name="otherSkills" defaultValue={member.otherSkills ?? ""} />
        <Field
          label="General availability (comma separated)"
          name="availability"
          defaultValue={member.availability.join(", ")}
        />
        <Field label="Access needs" name="accessNeeds" defaultValue={member.accessNeeds ?? ""} />
        <div className="col-span-full flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Areas of service</span>
          <div className="flex flex-wrap gap-3">
            {serviceAreas.map((area) => (
              <label key={area.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="serviceAreaIds"
                  value={area.id}
                  defaultChecked={selectedServiceAreaIds.has(area.id)}
                />
                {area.name}
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-full flex flex-col gap-1">
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={member.notes ?? ""}
            rows={3}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Next of kin</legend>
        <Field label="Name" name="nokName" defaultValue={member.nokName ?? ""} />
        <Field label="Relationship" name="nokRelationship" defaultValue={member.nokRelationship ?? ""} />
        <Field label="Phone" name="nokPhone" defaultValue={member.nokPhone ?? ""} />
        <Field label="Alternative phone" name="nokAltPhone" defaultValue={member.nokAltPhone ?? ""} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Consent</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consentRecords" defaultChecked={member.consentRecords} />
          Consents to their record being kept
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consentDirectory" defaultChecked={member.consentDirectory} />
          Consents to being listed in the directory
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consentComms" defaultChecked={member.consentComms} />
          Consents to communications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consentBiometric" defaultChecked={member.consentBiometric} />
          Consents to biometric enrolment
        </label>
      </fieldset>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
