import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";

/** A titled group on a tab, like the web sidebar's section headings. */
export function Section({ icon, title, note, children }: { icon: LucideIcon; title: string; note?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <CmpIcon as={icon} size={16} className="text-muted-foreground" />
        <CmpText className="font-semibold">{title}</CmpText>
        {note && <CmpText className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>{note}</CmpText>}
      </View>
      {children}
    </View>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <CmpText className="text-sm text-destructive">{error}</CmpText> : null;
}
