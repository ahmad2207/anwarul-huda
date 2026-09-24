"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createAnnouncementAction } from "./actions";

export function AnnouncementForm({ wings }: { wings: Array<{ id: string; name: string }> }) {
  const [state, formAction, isPending] = useActionState(createAnnouncementAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-sabon/30 bg-sabon/10 p-2 text-sm text-sabon">Announcement posted.</p>
      ) : null}

      <FormField label="Title" htmlFor="announcement-title">
        <Input id="announcement-title" name="title" required maxLength={200} />
      </FormField>

      <FormField label="Message" htmlFor="announcement-body">
        <textarea
          id="announcement-body"
          name="body"
          rows={3}
          required
          maxLength={1000}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </FormField>

      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Who sees it" htmlFor="announcement-wing">
          <select
            id="announcement-wing"
            name="wingId"
            defaultValue=""
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All wings</option>
            {wings.map((wing) => (
              <option key={wing.id} value={wing.id}>
                {wing.name} only
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Publish at, Lagos time (leave blank for now)" htmlFor="announcement-publish-at">
          <Input id="announcement-publish-at" name="publishAt" type="datetime-local" />
        </FormField>
        <label className="flex h-8 items-center gap-1.5 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked />
          Published
        </label>
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Posting..." : "Post announcement"}
      </Button>
    </form>
  );
}
