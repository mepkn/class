/**
 * Strips formatting delimiters (such as ++ underlines, %% notes, and HTML <u> tags)
 * so that clean, pure text is copied to the clipboard.
 */
export function cleanCopyText(source: string): string {
  return source
    .replace(/^\s*%%.*$/gm, "")
    .replace(/\+\+([^\s+](?:[^\n+]*?[^\s+])?)\+\+/g, "$1")
    .replace(/<\/?u>/gi, "")
    .trim();
}
