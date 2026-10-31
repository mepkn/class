import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpKeyboardAwareScrollView } from "@/components/cmp/cmp-keyboard-aware-scroll-view";
import { CmpText } from "@/components/cmp/cmp-text";
import { type AuthStep, signInErrorMessage } from "@/lib/errors";

// Each step sends one Convex Auth Password flow.
const FLOWS: Record<AuthStep, string> = {
  signIn: "signIn",
  verify: "email-verification",
  forgot: "reset",
  reset: "reset-verification",
};

const COPY: Record<AuthStep, { title: string; subtitle: string; submit: string }> = {
  signIn: { title: "Sign in to teach", subtitle: "Use your teacher account from class.pknspace.com/teacher.", submit: "Sign in" },
  verify: { title: "Check your email", subtitle: "Enter the 6-digit code we sent to", submit: "Verify" },
  forgot: { title: "Reset password", subtitle: "We'll email you a 6-digit code.", submit: "Send code" },
  reset: { title: "Choose a new password", subtitle: "Enter the code we sent to", submit: "Reset password" },
};

// Sign in only: the teacher account is created on the web page (/teacher).
// A code by email verifies an address that never was, and resets a password.
export default function SignInScreen() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const codeStep = step === "verify" || step === "reset";
  const needsPassword = step === "signIn" || step === "reset";
  const normalized = email.trim().toLowerCase();

  function go(next: AuthStep) {
    setStep(next);
    setError(undefined);
    setCode("");
    setPassword("");
  }

  async function submit() {
    setError(undefined);
    if (step === "reset" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const params: Record<string, string> = { email: normalized, flow: FLOWS[step] };
    if (codeStep) params.code = code.trim();
    if (step === "reset") params.newPassword = password;
    else if (needsPassword) params.password = password;
    setSubmitting(true);
    try {
      const { signingIn } = await signIn("password", params);
      // Not signed in yet means a code was emailed: an unverified sign-in or a reset request.
      if (!signingIn) go(step === "forgot" ? "reset" : "verify");
    } catch (e) {
      setError(signInErrorMessage(e, step));
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[step];
  const ready = codeStep
    ? code.trim().length === 6 && (step !== "reset" || password.length > 0)
    : normalized.length > 0 && (!needsPassword || password.length > 0);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <CmpKeyboardAwareScrollView contentContainerClassName="mx-auto w-full max-w-md flex-grow justify-center gap-6 p-6">
        <View className="gap-2">
          <CmpText className="text-lg font-semibold text-brand">Class Remote</CmpText>
          <CmpText variant="h3">{copy.title}</CmpText>
          <CmpText variant="muted">{codeStep ? `${copy.subtitle} ${normalized}.` : copy.subtitle}</CmpText>
        </View>
        <View className="gap-4">
          {!codeStep && (
            <CmpInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              onSubmitEditing={step === "forgot" ? submit : undefined}
            />
          )}
          {codeStep && (
            <CmpInput
              label="Code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
              onSubmitEditing={step === "verify" ? submit : undefined}
            />
          )}
          {needsPassword && (
            <CmpInput
              label={step === "reset" ? "New password" : "Password"}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={step === "reset" ? "new-password" : "current-password"}
              textContentType={step === "reset" ? "newPassword" : "password"}
              onSubmitEditing={submit}
            />
          )}
          {error && <CmpText className="text-sm text-destructive">{error}</CmpText>}
          <CmpButton label={copy.submit} loading={submitting} disabled={!ready} onPress={submit} />
        </View>
        <View className="items-center gap-1">
          {step === "signIn" ? (
            <CmpButton variant="link" label="Forgot password?" onPress={() => go("forgot")} />
          ) : (
            <CmpButton variant="link" label="Back to sign in" onPress={() => go("signIn")} />
          )}
        </View>
      </CmpKeyboardAwareScrollView>
    </SafeAreaView>
  );
}
