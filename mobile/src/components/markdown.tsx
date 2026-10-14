import { useEffect, useState } from "react";
import { Image, StyleSheet, Text } from "react-native";
import Markdown, { type RenderRules } from "react-native-markdown-display";
import { THEME } from "@/lib/theme";

const mono = { fontFamily: "monospace", fontSize: 13 };

// Chalk on the board, like the students' screen. Math ($…$) shows as written.
const styles = StyleSheet.create({
  body: { color: THEME.chalk, fontSize: 15, lineHeight: 22 },
  heading1: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  heading2: { fontSize: 19, fontWeight: "700", marginBottom: 4 },
  heading3: { fontSize: 17, fontWeight: "600" },
  link: { color: THEME.primary, textDecorationLine: "underline" },
  blockquote: { backgroundColor: "transparent", borderLeftColor: THEME.primary, borderLeftWidth: 3, paddingLeft: 8, marginLeft: 0 },
  code_inline: { ...mono, backgroundColor: THEME.code, color: THEME.chalk },
  code_block: { ...mono, backgroundColor: THEME.code, color: THEME.chalk, borderWidth: 0, borderRadius: 6 },
  fence: { ...mono, backgroundColor: THEME.code, color: THEME.chalk, borderWidth: 0, borderRadius: 6 },
  hr: { backgroundColor: THEME.border },
  table: { borderColor: THEME.border },
  tr: { borderColor: THEME.border },
});

const plain = StyleSheet.create({ ...styles, body: { ...styles.body, color: THEME.foreground } });

// Wikimedia and some other hosts refuse requests without a browser-like User-Agent.
const IMAGE_HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android) ClassRemote" };

/** A slide image at the slide's width, keeping its shape; the alt text if it can't load. */
function SlideImage({ uri, alt }: { uri: string; alt: string }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    Image.getSizeWithHeaders(
      uri,
      IMAGE_HEADERS,
      (w, h) => setRatio(w / h),
      () => setFailed(true),
    );
  }, [uri]);
  if (failed) return <Text style={{ color: THEME.muted, fontStyle: "italic" }}>🖼 {alt || uri}</Text>;
  return (
    <Image
      source={{ uri, headers: IMAGE_HEADERS }}
      accessibilityLabel={alt}
      resizeMode="contain"
      onError={() => setFailed(true)}
      style={{ width: "100%", aspectRatio: ratio ?? 16 / 9, marginVertical: 4, borderRadius: 4 }}
    />
  );
}

const rules: RenderRules = {
  image: (node) => <SlideImage key={node.key} uri={String(node.attributes.src)} alt={String(node.attributes.alt ?? "")} />,
};

/** Lesson Markdown, read-only. `onBoard` uses the board's chalk colours. */
export function MarkdownView({ content, onBoard = false }: { content: string; onBoard?: boolean }) {
  return (
    <Markdown style={onBoard ? styles : plain} rules={rules}>
      {content}
    </Markdown>
  );
}
