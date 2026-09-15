"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Wing } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createContentAction } from "./actions";
import { CONTENT_TYPES } from "./schema";

const TYPE_LABELS: Record<(typeof CONTENT_TYPES)[number], string> = {
  SERMON: "Sermon",
  WEEKLY_BOOK: "Weekly book",
  ARTICLE: "Article",
  ANNOUNCEMENT: "Announcement",
};

export function ContentForm({ wings }: { wings: Wing[] }) {
  const [state, formAction, isPending] = useActionState(createContentAction, {});
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
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700 dark:text-emerald-400">
          Uploaded.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Type</Label>
          <select name="type" defaultValue="SERMON" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            {CONTENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label className="text-xs">Title</Label>
          <Input name="title" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Speaker or author</Label>
          <Input name="author" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Summary</Label>
        <textarea
          name="summary"
          rows={2}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Notes or full text (optional if a file or link is provided)</Label>
        <textarea name="body" rows={4} className="rounded-md border border-input bg-background px-2 py-1 text-sm" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">File: audio, PDF or similar (optional if a link or notes are provided)</Label>
          <Input name="file" type="file" accept="audio/*,video/*,application/pdf" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Cover image (optional)</Label>
          <Input name="coverImage" type="file" accept="image/*" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">External video link (optional)</Label>
        <Input name="externalUrl" type="url" placeholder="https://..." />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Tags, comma separated</Label>
          <Input name="tags" placeholder="ramadan, family, youth" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Date delivered</Label>
          <Input name="deliveredOn" type="date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Publish at (optional, leave blank for immediately)</Label>
          <Input name="publishAt" type="datetime-local" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {wings.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Restrict to one wing (optional)</Label>
            <select name="wingId" defaultValue="" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All wings</option>
              {wings.map((wing) => (
                <option key={wing.id} value={wing.id}>
                  {wing.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked />
          Published
        </label>
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}
