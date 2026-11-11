import type { ReactNode } from "react";

// Site texts stay plain strings; **bold**, *italic*, {+bigger+} and {-smaller-} marks become React elements, never HTML.
// Sizes are relative (em), so they still follow the A / A+ / A++ choice.
// shortcut: bold inside italic (*a **b** c*) is not parsed, italic inside bold is; upgrade to a real parser if staff needs it.
export const MARK = /\*\*(.+?)\*\*|\*(.+?)\*|\{\+(.+?)\+\}|\{-(.+?)-\}/gs;
export const SIZE = { up: "text-[1.3em]", down: "text-[0.8em]" } as const;

export function rich(text: string | null | undefined): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] !== undefined ? (
        <strong key={m.index}>{rich(m[1])}</strong>
      ) : m[2] !== undefined ? (
        <em key={m.index}>{rich(m[2])}</em>
      ) : (
        <span
          key={m.index}
          className={m[3] !== undefined ? SIZE.up : SIZE.down}
        >
          {rich(m[3] ?? m[4])}
        </span>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Text without the marks: for aria-label, title, map search and other plain places. */
export const plain = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/\{[+-](.+?)[+-]\}/gs, "$1");
