"use client";

import { Field, FormError, SectionActions } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
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
  const { state: error, formAction, isPending, value } = useRememberedForm(saveNameSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {fullNameAsWritten ? (
        <div className="flex flex-col gap-2">
          <p className="text-base text-ink-2">On our records you appear as:</p>
          <p className="rounded-[14px] bg-paper-dim p-4 text-lg font-semibold">{fullNameAsWritten}</p>
          <p className="text-base text-ink-2">
            Our old register wrote names in different orders, so we need you to tell us which part is which.
          </p>
        </div>
      ) : null}

      <Field label="Title" id="title" defaultValue={value("title", title ?? "")} />
      <Field label="Surname" id="surname" required defaultValue={value("surname", surname ?? "")} />
      <Field label="First name" id="firstName" required defaultValue={value("firstName", firstName ?? "")} />
      <Field label="Other names" id="otherNames" defaultValue={value("otherNames", otherNames ?? "")} />

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}
