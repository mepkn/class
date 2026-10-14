import { api } from "@convex/_generated/api";
import { linksIn } from "@convex/lib/links";
import { splitSlides } from "@convex/lib/slides";
import { useAction, useMutation, useQuery } from "convex/react";
import { Globe, RotateCw, TriangleAlert, Undo2 } from "lucide-react-native";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";
import { ErrorText } from "@/components/section";
import { useAct } from "@/lib/use-act";

/** Opens the live lesson's links on every screen, and brings everyone back to the board. */
export default function LinksScreen() {
  const session = useQuery(api.classroom.getActiveSession);
  const source = useQuery(api.classroom.getLiveSource);
  const showLink = useMutation(api.classroom.showLink);
  const closeLinks = useMutation(api.classroom.closeLinks);
  const checkLink = useAction(api.links.checkLink);
  const { busy, error, act } = useAct();

  // Each link once, with the first slide it's on.
  const seen = new Set<string>();
  const slides = splitSlides(source ?? "");
  const links = slides.flatMap((part, slide) =>
    linksIn(part)
      .filter((l) => !seen.has(l.url) && seen.add(l.url))
      .map((l) => ({ ...l, slide })),
  );
  const blocked = useQuery(api.links.blocked, links.length > 0 ? { urls: links.map((l) => l.url) } : "skip") ?? [];

  if (session === undefined || source === undefined) return <ActivityIndicator className="flex-1 bg-background" />;
  const open = session.link;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-3 p-4">
      <CmpText variant="muted">Open a page on every screen, over the board. Only you can close it.</CmpText>
      {open && (
        <Pressable onPress={() => void Linking.openURL(open)} className="flex-row items-center gap-2 rounded-lg bg-primary/15 px-3 py-2">
          <CmpIcon as={Globe} size={16} className="text-primary" />
          <CmpText className="flex-1 text-sm" numberOfLines={1}>{open}</CmpText>
        </Pressable>
      )}
      <CmpButton
        variant={open ? "default" : "outline"}
        icon={Undo2}
        label="Back to board"
        disabled={busy}
        onPress={() => act(() => closeLinks())}
      />
      <ErrorText error={error} />

      {links.length === 0 ? (
        <CmpText variant="muted">No links on the live board.</CmpText>
      ) : (
        links.map((l) => (
          <View key={l.url} className="flex-row items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Pressable className="flex-1" onPress={() => void Linking.openURL(l.url)}>
              <CmpText numberOfLines={1}>{l.text}</CmpText>
              <CmpText className="text-xs text-muted-foreground" numberOfLines={1}>
                {slides.length > 1 ? `slide ${l.slide + 1} · ` : ""}
                {l.url}
              </CmpText>
            </Pressable>
            {blocked.includes(l.url) ? (
              <View className="flex-row items-center gap-1">
                <CmpIcon as={TriangleAlert} size={14} className="text-warning" />
                <CmpText className="text-xs text-warning">New tab</CmpText>
                <CmpButton
                  variant="ghost"
                  size="icon"
                  icon={RotateCw}
                  label={`Check ${l.text} again`}
                  disabled={busy}
                  onPress={() => act(() => checkLink({ url: l.url }))}
                />
              </View>
            ) : (
              <CmpButton
                size="sm"
                variant="secondary"
                label={l.url === open ? "Showing" : "Show"}
                disabled={busy || l.url === open}
                onPress={() => act(() => showLink({ url: l.url }))}
              />
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
