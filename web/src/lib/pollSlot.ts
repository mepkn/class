import { createContext, type ReactNode } from "react";

/**
 * Renders the inline ```poll block at `blockIndex` of the Markdown being shown (null = render
 * nothing). Without a provider, or when it returns undefined, MarkdownRenderer shows a static
 * preview of the poll instead (the teacher's editor).
 */
export type PollSlot = (blockIndex: number) => ReactNode | undefined;

export const PollSlotContext = createContext<PollSlot | undefined>(undefined);
