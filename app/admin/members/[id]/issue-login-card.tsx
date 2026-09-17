"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildLoginSlipsHtml } from "@/lib/print/login-slip";
import { openPrintWindow } from "@/lib/print/open-print-window";
import { issueLogin } from "./credentials-actions";

export function IssueLoginCard({
  memberId,
  memberNumber,
  hasAccount,
  mustChangePassword,
}: {
  memberId: string;
  memberNumber: string | null;
  hasAccount: boolean;
  mustChangePassword: boolean;
}) {
  const boundIssueLogin = issueLogin.bind(null, memberId);
  const [issueState, issueAction, isIssuing] = useActionState(boundIssueLogin, {});

  const [copied, setCopied] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // Shown exactly once, immediately after generation, from this response
  // alone: nothing re-fetches it, because nothing after this point ever
  // holds the plaintext value again. The printable slip is built from
  // this same response, for the same reason.
  if (issueState.temporaryPassword) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-sabon/40 bg-sabon-soft p-3 text-sm">
        <p className="font-medium">
          Temporary password for {issueState.memberName}
          {issueState.memberNumber ? ` (${issueState.memberNumber})` : ""}. Write it down or copy it now
          &mdash; it will not be shown again.
        </p>
        <p className="select-all rounded bg-background px-3 py-2 font-mono text-lg tracking-[0.2em]">
          {issueState.temporaryPassword}
        </p>
        <p className="text-xs text-muted-foreground">
          Sign in with the member number above. If this is lost before the member signs in, issue a new
          one; the one above will stop working.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(issueState.temporaryPassword ?? "");
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy password"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const opened = openPrintWindow(
                buildLoginSlipsHtml(
                  [
                    {
                      memberName: issueState.memberName ?? "",
                      memberNumber: issueState.memberNumber ?? null,
                      temporaryPassword: issueState.temporaryPassword ?? "",
                    },
                  ],
                  `${window.location.origin}/logo.png`,
                ),
              );
              setPopupBlocked(!opened);
            }}
          >
            Print slip
          </Button>
        </div>
        {popupBlocked ? (
          <p className="text-xs text-destructive">
            The print window was blocked. Allow pop-ups for this site and try again.
          </p>
        ) : null}
      </div>
    );
  }

  if (!memberNumber) {
    return (
      <p className="text-sm text-muted-foreground">
        A login cannot be issued yet: this member has no member number. One is issued on approval, before
        which there is nothing to use as a username.
      </p>
    );
  }

  return (
    <form action={issueAction} className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {hasAccount
          ? mustChangePassword
            ? "A temporary password was issued and has not yet been used to sign in."
            : "This member already has login credentials."
          : "This member has no login yet."}
      </p>
      <Button
        type="submit"
        size="sm"
        variant={hasAccount ? "outline" : "default"}
        disabled={isIssuing}
        className="self-start"
      >
        {isIssuing ? "Generating..." : hasAccount ? "Reissue login" : "Issue login"}
      </Button>
      {issueState.error ? <p className="text-xs text-destructive">{issueState.error}</p> : null}
    </form>
  );
}
