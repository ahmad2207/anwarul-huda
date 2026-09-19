"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { buildLoginSlipsHtml } from "@/lib/print/login-slip";
import { openPrintWindow } from "@/lib/print/open-print-window";
import { bulkIssueLogin, bulkReissueAllLogins } from "./actions";
import type { BulkIssueRowError, BulkIssueRowResult, BulkReissueState } from "./actions";

export interface EligibleMemberRow {
  id: string;
  name: string;
  memberNumber: string;
  wingName: string;
}

export function BulkIssueLoginForm({
  eligibleMembers,
  notYetApprovedNames,
  alreadyIssuedCount,
}: {
  eligibleMembers: EligibleMemberRow[];
  notYetApprovedNames: string[];
  alreadyIssuedCount: number;
}) {
  const [state, formAction, isPending] = useActionState(bulkIssueLogin, {});
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(eligibleMembers.map((member) => [member.id, true])),
  );

  const selectedCount = Object.values(checked).filter(Boolean).length;

  function setAll(value: boolean) {
    setChecked(Object.fromEntries(eligibleMembers.map((member) => [member.id, value])));
  }

  if (state.issued && state.issued.length + (state.failed?.length ?? 0) > 0) {
    return <BulkIssueResults issued={state.issued} failed={state.failed ?? []} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {eligibleMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No member is both missing a login and has a member number right now.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selectedCount} of {eligibleMembers.length} selected.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(false)}>
                Select none
              </Button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted text-left">
                <tr>
                  <th className="w-8 p-2"></th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Member number</th>
                  <th className="p-2 font-medium">Wing</th>
                </tr>
              </thead>
              <tbody>
                {eligibleMembers.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        name="memberIds"
                        value={member.id}
                        checked={checked[member.id] ?? false}
                        onChange={(event) =>
                          setChecked((current) => ({ ...current, [member.id]: event.target.checked }))
                        }
                        aria-label={`Select ${member.name}`}
                      />
                    </td>
                    <td className="p-2">{member.name}</td>
                    <td className="p-2 font-mono text-xs">{member.memberNumber}</td>
                    <td className="p-2">{member.wingName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <Button type="submit" disabled={isPending || selectedCount === 0} className="self-start">
            {isPending ? "Issuing..." : `Issue login for ${selectedCount} member${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </form>
      )}

      {notYetApprovedNames.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Not yet approved ({notYetApprovedNames.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              These members have no member number yet, so a login cannot be issued. A number is issued on
              approval.
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {notYetApprovedNames.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ReissueAllSection alreadyIssuedCount={alreadyIssuedCount} />
    </div>
  );
}

// No selection, no exceptions: reissuing invalidates the current
// password for every member who has a login, in the actor's own wing
// scope, the moment this commits. Kept out of the main form and behind
// its own reveal-then-confirm step (the same pattern void-form.tsx
// uses for voiding a payment) precisely because there is no undo and
// no way to narrow it to fewer members after the fact.
function ReissueAllSection({ alreadyIssuedCount }: { alreadyIssuedCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<BulkReissueState, FormData>(bulkReissueAllLogins, {});

  if (alreadyIssuedCount === 0) {
    return null;
  }

  if (state.issued && state.issued.length + (state.failed?.length ?? 0) > 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Logins reissued for everyone</p>
        <BulkIssueResults issued={state.issued} failed={state.failed ?? []} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Reissue every login</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Generates a brand new temporary password for all {alreadyIssuedCount} member
          {alreadyIssuedCount === 1 ? "" : "s"} who already have a login. No selection: this is everyone, and
          each current password stops working the moment this commits.
        </p>
        {!confirming ? (
          <Button type="button" variant="destructive" className="self-start" onClick={() => setConfirming(true)}>
            Reissue every login
          </Button>
        ) : (
          <form action={formAction} className="flex flex-col gap-2 rounded-md border bg-paper-dim p-3">
            <p className="text-sm font-medium text-destructive">
              This cannot be undone. Every one of the {alreadyIssuedCount} current passwords stops working
              immediately, whether or not it was ever used.
            </p>
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
                {isPending ? "Reissuing..." : `Yes, reissue all ${alreadyIssuedCount}`}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </CardContent>
    </Card>
  );
}

export function BulkIssueResults({ issued, failed }: { issued: BulkIssueRowResult[]; failed: BulkIssueRowError[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const columns: DataTableColumn<BulkIssueRowResult>[] = [
    { key: "name", header: "Name", cell: (row) => row.memberName },
    { key: "memberNumber", header: "Member number", cell: (row) => row.memberNumber ?? "Not yet issued" },
    {
      key: "password",
      header: "Temporary password",
      cell: (row) => <span className="font-mono tracking-wider">{row.temporaryPassword}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(row.temporaryPassword);
            setCopiedId(row.memberId);
          }}
        >
          {copiedId === row.memberId ? "Copied" : "Copy password"}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-sabon/40 bg-sabon-soft p-3 text-sm">
        <p className="font-medium">
          {issued.length} login{issued.length === 1 ? "" : "s"} issued
          {failed.length > 0 ? `, ${failed.length} failed` : ""}. Every password below is shown exactly
          once, now &mdash; write them down, copy them, or print the sheet before leaving this page.
        </p>
      </div>

      {issued.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="self-start"
            onClick={() => {
              const opened = openPrintWindow(
                buildLoginSlipsHtml(
                  issued.map((row) => ({
                    memberName: row.memberName,
                    memberNumber: row.memberNumber,
                    temporaryPassword: row.temporaryPassword,
                  })),
                  `${window.location.origin}/logo.png`,
                ),
              );
              setPopupBlocked(!opened);
            }}
          >
            Print all slips ({issued.length})
          </Button>
          {popupBlocked ? (
            <p className="text-xs text-destructive">
              The print window was blocked. Allow pop-ups for this site and try again.
            </p>
          ) : null}
          <DataTable columns={columns} rows={issued} rowKey={(row) => row.memberId} emptyMessage="" />
        </div>
      ) : null}

      {failed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-destructive">
              Could not issue ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {failed.map((row) => (
                <li key={row.memberId}>
                  {row.memberName}: {row.error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
