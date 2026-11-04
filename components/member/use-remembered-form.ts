"use client";

import { useActionState, useState } from "react";

// React 19 resets an uncontrolled form once its action finishes. When the
// server sends back an error, that throws away everything the member
// typed. This wraps useActionState so the last submitted values are kept
// and can be fed back as each field's defaultValue: the reset then puts
// back what was typed rather than what was saved before.
//
// `isSuccess`, when given, forgets the typed values after a successful
// submission, for a form that should come back empty (adding another
// household member, for example).
export function useRememberedForm<State>(
  action: (previousState: State, formData: FormData) => Promise<State>,
  initialState: State,
  isSuccess?: (state: State) => boolean,
) {
  const [submitted, setSubmitted] = useState<FormData | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [state, formAction, isPending] = useActionState<State, FormData>(async (previousState, formData) => {
    setSubmitted(formData);
    const result = await action(previousState as State, formData);
    if (isSuccess?.(result)) {
      setSubmitted(null);
      setSuccessCount((count) => count + 1);
    }
    return result;
  }, initialState as Awaited<State>);

  function value(name: string, saved: string): string {
    if (!submitted) return saved;
    const entry = submitted.get(name);
    return typeof entry === "string" ? entry : "";
  }

  function checked(name: string, saved: boolean): boolean {
    if (!submitted) return saved;
    return submitted.has(name);
  }

  function checkedValue(name: string, optionValue: string, saved: boolean): boolean {
    if (!submitted) return saved;
    return submitted.getAll(name).includes(optionValue);
  }

  return { state, formAction, isPending, value, checked, checkedValue, successCount };
}
