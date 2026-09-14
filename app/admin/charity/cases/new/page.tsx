import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCaseForm } from "./new-case-form";

export default async function NewCharityCasePage() {
  await requireRole(["CHARITY_OFFICER"]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">New beneficiary case</h1>
        <p className="text-sm text-muted-foreground">Starts as a draft, for someone else to verify.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Case details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewCaseForm />
        </CardContent>
      </Card>
    </div>
  );
}
