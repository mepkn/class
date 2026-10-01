import type { ReactNode } from "react";

interface Props {
  /** The old board, rendered on top and wiped away to reveal what's underneath. */
  children: ReactNode;
  onDone: () => void;
}

/**
 * A hand with a blackboard duster sweeps left → right in a zig-zag. The old
 * board (children) is clipped away behind it, revealing the new board below.
 * Timing lives in index.css (`--duster-ms`); all three animations share it.
 */
export function DusterWipe({ children, onDone }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      <div className="duster-erase absolute inset-0 bg-board">{children}</div>
      <div className="duster-smear absolute inset-y-0" />
      <div className="duster-hand absolute" onAnimationEnd={(e) => e.animationName === "duster-x" && onDone()}>
        <span className="duster-dust duster-dust-1" />
        <span className="duster-dust duster-dust-2" />
        <span className="duster-dust duster-dust-3" />
        <HandWithDuster />
      </div>
    </div>
  );
}

function HandWithDuster() {
  return (
    <svg viewBox="0 0 220 190" className="relative h-auto w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]">
      {/* sleeve + forearm, coming from the lower right */}
      <path d="M150 120 L215 185 L180 190 L128 138 Z" fill="#2f4f75" />
      <path d="M150 120 L215 185" stroke="#1f3a5a" strokeWidth="4" />
      <path d="M132 102 L160 128 L140 148 L112 122 Z" fill="#e9b98a" stroke="#b9835a" strokeWidth="2" />

      {/* duster: wooden back */}
      <rect x="22" y="40" width="150" height="46" rx="10" fill="#8a5a2f" />
      <rect x="22" y="40" width="150" height="14" rx="7" fill="#a8733f" />
      <path d="M40 60 C 70 56, 110 64, 158 58" stroke="#6f4522" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M38 72 C 80 68, 120 76, 160 70" stroke="#6f4522" strokeWidth="2" fill="none" opacity="0.45" />
      {/* duster: felt pad, dusty with chalk */}
      <rect x="18" y="82" width="158" height="22" rx="6" fill="#d9d4c7" />
      <rect x="18" y="96" width="158" height="8" rx="4" fill="#f4f1ea" />
      <circle cx="40" cy="92" r="2" fill="#fff" opacity="0.8" />
      <circle cx="90" cy="95" r="1.6" fill="#fff" opacity="0.7" />
      <circle cx="140" cy="91" r="2.2" fill="#fff" opacity="0.8" />

      {/* hand gripping the top of the duster */}
      <path
        d="M70 44 C 66 22, 92 10, 118 14 C 140 17, 156 30, 156 48 L 150 100 C 148 116, 132 124, 118 120 L 92 112 Z"
        fill="#f1c59a"
        stroke="#b9835a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* fingers curling over the front of the duster */}
      <rect x="72" y="34" width="20" height="44" rx="10" fill="#f1c59a" stroke="#b9835a" strokeWidth="2.5" />
      <rect x="92" y="30" width="20" height="50" rx="10" fill="#f1c59a" stroke="#b9835a" strokeWidth="2.5" />
      <rect x="112" y="32" width="20" height="48" rx="10" fill="#f1c59a" stroke="#b9835a" strokeWidth="2.5" />
      <rect x="132" y="38" width="18" height="40" rx="9" fill="#f1c59a" stroke="#b9835a" strokeWidth="2.5" />
      {/* knuckle creases */}
      <path d="M77 52 h10 M97 50 h10 M117 51 h10 M136 54 h9" stroke="#c99068" strokeWidth="2" strokeLinecap="round" />
      {/* thumb wrapping the left end */}
      <path
        d="M74 46 C 54 44, 44 56, 50 70 C 54 80, 66 80, 72 72"
        fill="#f1c59a"
        stroke="#b9835a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
