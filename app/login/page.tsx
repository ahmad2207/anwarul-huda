import { PublicFrame } from "@/components/member/public-frame";
import { LoginForm } from "./login-form";

// The login lockup is one of the four places Arabic appears (DESIGN.md 3).
export default function LoginPage() {
  return (
    <PublicFrame showArabic>
      <LoginForm />
    </PublicFrame>
  );
}
