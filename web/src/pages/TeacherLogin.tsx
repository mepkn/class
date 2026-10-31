import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "signIn" | "signUp" | "verify" | "forgot" | "reset";

const copy: Record<Step, { title: string; description: string; submit: string }> = {
  signIn: { title: "Teacher sign-in", description: "Sign in to run the classroom.", submit: "Sign in" },
  signUp: {
    title: "Teacher sign-up",
    description: "Create the teacher account. Only allowlisted emails can sign up.",
    submit: "Create account",
  },
  verify: { title: "Check your email", description: "Enter the 6-digit code we sent to", submit: "Verify" },
  forgot: { title: "Reset password", description: "We'll email you a 6-digit code.", submit: "Send code" },
  reset: { title: "Choose a new password", description: "Enter the code we sent to", submit: "Reset password" },
};

// Each step sends one Convex Auth Password flow.
const flows: Record<Step, string> = {
  signIn: "signIn",
  signUp: "signUp",
  verify: "email-verification",
  forgot: "reset",
  reset: "reset-verification",
};

function friendly(err: unknown, step: Step): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/allowlist/i.test(raw)) return "This email is not on the teacher allowlist.";
  if (/already exists/i.test(raw)) return "An account with this email already exists — sign in instead.";
  if (/send the email/i.test(raw)) return "Could not send the email. Try again in a minute.";
  if (step === "verify" || step === "reset") return "That code is wrong or has expired.";
  if (/InvalidSecret|InvalidAccountId|Invalid password/i.test(raw)) return "Wrong email or password.";
  if (/password/i.test(raw) && step === "signUp") return "Password must be at least 8 characters.";
  if (step === "forgot") return "Could not send a reset code.";
  return step === "signIn" ? "Could not sign in. Check your email and password." : "Could not create the account.";
}

/**
 * Email + password, with a code by email to verify the address at sign-up
 * (and on sign-in if it never was) and to reset a forgotten password.
 */
export function TeacherLogin() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>("signIn");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (next: Step) => {
    setStep(next);
    setError(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("email", email.trim().toLowerCase());
    formData.set("flow", flows[step]);
    try {
      const { signingIn } = await signIn("password", formData);
      // Not signed in yet means a code was emailed: sign-up, an unverified
      // sign-in, or a reset request.
      if (!signingIn) go(step === "forgot" ? "reset" : "verify");
    } catch (err) {
      setError(friendly(err, step));
    } finally {
      setPending(false);
    }
  };

  const codeStep = step === "verify" || step === "reset";
  const { title, description, submit } = copy[step];

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LockKeyhole className="size-5 text-primary" /> {title}
          </CardTitle>
          <CardDescription>{codeStep ? `${description} ${email.trim().toLowerCase()}.` : description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} key={step}>
            {!codeStep && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            {codeStep && (
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            )}
            {(step === "signIn" || step === "signUp" || step === "reset") && (
              <div className="space-y-1.5">
                <Label htmlFor="password">{step === "reset" ? "New password" : "Password"}</Label>
                <Input
                  id="password"
                  name={step === "reset" ? "newPassword" : "password"}
                  type="password"
                  minLength={8}
                  autoComplete={step === "signIn" ? "current-password" : "new-password"}
                  required
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {submit}
            </Button>
            {step === "signIn" ? (
              <div className="flex flex-col">
                <Button type="button" variant="link" className="w-full font-normal text-muted-foreground" onClick={() => go("forgot")}>
                  Forgot password?
                </Button>
                <Button type="button" variant="link" className="w-full font-normal text-muted-foreground" onClick={() => go("signUp")}>
                  First time? Create the teacher account
                </Button>
              </div>
            ) : (
              <Button type="button" variant="link" className="w-full font-normal text-muted-foreground" onClick={() => go("signIn")}>
                {step === "signUp" ? "Already have an account? Sign in" : "Back to sign in"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
