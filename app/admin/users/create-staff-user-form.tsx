"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createStaffUserAction } from "./actions";
import type { CreateStaffUserState } from "./actions";
import { STAFF_ROLE_LABELS } from "./schema";

const WING_ADMIN_ROLE_OPTIONS = ["WING_ADMIN", "ATTENDANCE_OFFICER"] as const;
const WING_SCOPED_ROLES = new Set(["WING_ADMIN", "ATTENDANCE_OFFICER"]);

export function CreateStaffUserForm({
  isSuperAdmin,
  wings,
  actorWingIds,
}: {
  isSuperAdmin: boolean;
  wings: Array<{ id: string; name: string }>;
  actorWingIds: string[];
}) {
  const [state, formAction, isPending] = useActionState<CreateStaffUserState, FormData>(
    createStaffUserAction,
    {},
  );
  const [role, setRole] = useState<string>(isSuperAdmin ? "WING_ADMIN" : "ATTENDANCE_OFFICER");
  const [copied, setCopied] = useState(false);

  // A wing admin only ever grants a wing scoped role, and only for a
  // wing they themselves are assigned to (enforced again, independently,
  // in actions.ts): this list is what they are offered, not what keeps
  // them from asking for more.
  const roleOptions = isSuperAdmin ? (Object.keys(STAFF_ROLE_LABELS) as Array<keyof typeof STAFF_ROLE_LABELS>) : WING_ADMIN_ROLE_OPTIONS;
  const wingOptions = isSuperAdmin ? wings : wings.filter((wing) => actorWingIds.includes(wing.id));
  const needsWing = WING_SCOPED_ROLES.has(role);

  if (state.result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Account created</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm">
            {state.result.email} &middot; {STAFF_ROLE_LABELS[state.result.role as keyof typeof STAFF_ROLE_LABELS]}
          </p>
          <p className="text-sm text-muted-foreground">
            Temporary password, shown exactly once, now &mdash; write it down or copy it before leaving this page.
            It cannot be shown again; if it is lost, this account needs a new one issued instead.
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-md border bg-paper-dim px-3 py-1.5 font-mono tracking-wider">
              {state.result.temporaryPassword}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(state.result!.temporaryPassword);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Add a new account</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required className="w-64" />
          </FormField>
          <FormField label="Phone (optional)" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" className="w-48" />
          </FormField>
          <FormField label="Role" htmlFor="role">
            <select
              id="role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {STAFF_ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </FormField>
          {needsWing ? (
            <FormField label="Wing" htmlFor="wingId">
              <select
                id="wingId"
                name="wingId"
                required
                defaultValue={wingOptions[0]?.id ?? ""}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {wingOptions.map((wing) => (
                  <option key={wing.id} value={wing.id}>
                    {wing.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create account"}
          </Button>
        </form>
        {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
      </CardContent>
    </Card>
  );
}
