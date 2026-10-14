import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpKeyboardAwareScrollView } from "@/components/cmp/cmp-keyboard-aware-scroll-view";
import { CmpText } from "@/components/cmp/cmp-text";
import { signInErrorMessage } from "@/lib/errors";

// Sign in only: the teacher account is created on the web page (/teacher).
export default function SignInScreen() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(undefined);
    setSubmitting(true);
    try {
      await signIn("password", { email: email.trim().toLowerCase(), password, flow: "signIn" });
    } catch (e) {
      setError(signInErrorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <CmpKeyboardAwareScrollView contentContainerClassName="mx-auto w-full max-w-md flex-grow justify-center gap-6 p-6">
        <View className="gap-2">
          <CmpText className="text-lg font-semibold text-brand">Class Remote</CmpText>
          <CmpText variant="h3">Sign in to teach</CmpText>
          <CmpText variant="muted">Use your teacher account from class.pknspace.com/teacher.</CmpText>
        </View>
        <View className="gap-4">
          <CmpInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <CmpInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
          />
          {error && <CmpText className="text-sm text-destructive">{error}</CmpText>}
          <CmpButton label="Sign in" loading={submitting} disabled={!email.trim() || !password} onPress={submit} />
        </View>
      </CmpKeyboardAwareScrollView>
    </SafeAreaView>
  );
}
