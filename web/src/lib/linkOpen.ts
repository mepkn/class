import { createContext } from "react";

/**
 * How a link in the rendered Markdown opens. Students' board: in the in-page panel
 * (`null` = not clickable at all, the teacher's monitor). Without a provider, links open
 * in a new tab (the teacher's editor preview).
 */
export type LinkOpener = ((url: string) => void) | null;

export const LinkOpenContext = createContext<LinkOpener | undefined>(undefined);
