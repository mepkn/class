// Board colors students can see. Shared by the backend (validation) and the UI.
// All dark, so the light "chalk" text stays readable.
export const BOARD_COLORS = [
  { id: "green", label: "Classic green", value: "oklch(0.22 0.025 165)" },
  { id: "black", label: "Blackboard", value: "oklch(0.17 0.005 260)" },
  { id: "slate", label: "Slate blue", value: "oklch(0.23 0.03 250)" },
  { id: "brown", label: "Walnut", value: "oklch(0.22 0.025 55)" },
  { id: "plum", label: "Plum", value: "oklch(0.21 0.03 320)" },
] as const;

export type BoardColorId = (typeof BOARD_COLORS)[number]["id"];
export const DEFAULT_BOARD_COLOR: BoardColorId = "green";

export function boardColorValue(id: string | null | undefined): string {
  return (BOARD_COLORS.find((c) => c.id === id) ?? BOARD_COLORS[0]).value;
}
