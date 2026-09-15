// DESIGN.md section 6: an empty state invites an action, it does not
// just report absence. The action is optional here because the copy
// pass that adds one everywhere it is missing is R6, not this step;
// this primitive just gives every empty list and table the same shape
// to land in once that copy exists.
export function EmptyState({ message, action }: { message: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 p-4 text-sm text-muted-foreground">
      <p>{message}</p>
      {action}
    </div>
  );
}
