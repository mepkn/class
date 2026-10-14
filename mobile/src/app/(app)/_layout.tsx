import { api } from "@convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { type ErrorBoundaryProps, router, Tabs } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import {
  BarChart3,
  Globe,
  LibraryBig,
  type LucideIcon,
  Presentation,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import { type ColorValue, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpText } from "@/components/cmp/cmp-text";
import { errorMessage } from "@/lib/errors";
import { THEME } from "@/lib/theme";

function tabIcon(Icon: LucideIcon, dot = false) {
  return function TabIcon({
    color,
    size,
  }: {
    color: ColorValue;
    size: number;
  }) {
    return (
      <View>
        <Icon color={color as string} size={size} />
        {dot && (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: THEME.primary,
            }}
          />
        )}
      </View>
    );
  };
}

export default function AppLayout() {
  // The phone stays on for the whole class.
  useKeepAwake();
  const session = useQuery(api.classroom.getActiveSession);

  // Opens on Board while a lesson is live, otherwise on Lessons to pick one.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || session === undefined) return;
    opened.current = true;
    if (
      session.mode === "intro" ||
      (session.mode === "lesson" && !session.activeLessonId)
    )
      router.navigate("/lessons");
  }, [session]);

  const slide = session?.slide.index ?? 0;
  const pollDot =
    !!session?.poll || !!session?.inlinePolls.some((p) => p.slide === slide);
  const linkDot = !!session?.link;

  // No header: the tab bar already names the screen. Each screen keeps clear of the status bar.
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: THEME.primary,
        }}
      >
        <Tabs.Screen
          name="lessons"
          options={{ title: "Lessons", tabBarIcon: tabIcon(LibraryBig) }}
        />
        <Tabs.Screen
          name="index"
          options={{ title: "Board", tabBarIcon: tabIcon(Presentation) }}
        />
        <Tabs.Screen
          name="polls"
          options={{ title: "Polls", tabBarIcon: tabIcon(BarChart3, pollDot) }}
        />
        <Tabs.Screen
          name="links"
          options={{ title: "Links", tabBarIcon: tabIcon(Globe, linkDot) }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

// A teacher query failed: most often an email no longer in ALLOWED_EMAILS, or no connection.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { signOut } = useAuthActions();
  return (
    <SafeAreaView className="flex-1 justify-center gap-4 bg-background p-6">
      <CmpText className="self-stretch text-xl font-semibold">Can&apos;t reach the class</CmpText>
      <CmpText variant="muted">{errorMessage(error)}</CmpText>
      <View className="flex-row gap-2">
        <CmpButton label="Try again" onPress={() => void retry()} />
        <CmpButton
          variant="outline"
          label="Sign out"
          onPress={() => void signOut()}
        />
      </View>
    </SafeAreaView>
  );
}
