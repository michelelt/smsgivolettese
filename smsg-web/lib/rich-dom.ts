import { MARK, SIZE } from "./rich";

// Editor side of lib/rich.tsx: marks <-> DOM of the contentEditable box, so staff sees bold/size live.
// The DOM is built from escaped text only, and read back to marks: no HTML is ever stored.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Marks to safe HTML for the editor box (same tags as the public site). */
export function toHtml(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    out += esc(text.slice(last, m.index));
    out +=
      m[1] !== undefined
        ? `<strong>${toHtml(m[1])}</strong>`
        : m[2] !== undefined
          ? `<em>${toHtml(m[2])}</em>`
          : `<span data-size="${m[3] !== undefined ? "up" : "down"}" class="${m[3] !== undefined ? SIZE.up : SIZE.down}">${toHtml(m[3] ?? m[4])}</span>`;
    last = m.index + m[0].length;
  }
  return (out + esc(text.slice(last))).replace(/\n/g, "<br>");
}

/** Editor box DOM back to marks. Unknown tags keep only their text. */
export function fromDom(node: Node, multiline: boolean): string {
  const nl = multiline ? "\n" : " ";
  let out = "";
  node.childNodes.forEach((c, i) => {
    if (c.nodeType === Node.TEXT_NODE) {
      out += (c.textContent ?? "").replace(/ /g, " ").replace(/\n/g, nl);
      return;
    }
    if (!(c instanceof HTMLElement)) return;
    const inner = fromDom(c, multiline);
    const tag = c.tagName;
    if (tag === "BR") out += nl;
    else if (!inner.trim()) out += inner;
    else if (tag === "STRONG" || tag === "B") out += `**${inner}**`;
    else if (tag === "EM" || tag === "I") out += `*${inner}*`;
    else if (c.dataset.size === "up") out += `{+${inner}+}`;
    else if (c.dataset.size === "down") out += `{-${inner}-}`;
    // Browsers wrap new lines in <div>: each one starts a line.
    else if (tag === "DIV" || tag === "P") out += (i > 0 ? nl : "") + inner;
    else out += inner;
  });
  return out;
}

/** Size button: wraps the selection in a size span, unwraps it when it already has that size, switches it otherwise.
 * The selection stays on the same text afterwards, so more buttons can be pressed. */
export function toggleSize(root: HTMLElement, dir: "up" | "down") {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;
  const select = (first: Node, last: Node) => {
    const r = document.createRange();
    r.setStartBefore(first);
    r.setEndAfter(last);
    sel.removeAllRanges();
    sel.addRange(r);
  };
  // A selection made by select() sits around the span: start from the span itself.
  const one =
    range.startContainer === range.endContainer &&
    range.endOffset - range.startOffset === 1
      ? range.startContainer.childNodes[range.startOffset]
      : null;
  for (
    let n: Node | null = one ?? range.commonAncestorContainer;
    n && n !== root;
    n = n.parentNode
  ) {
    if (!(n instanceof HTMLElement) || !n.dataset.size) continue;
    if (n.dataset.size !== dir) {
      n.dataset.size = dir;
      n.className = SIZE[dir];
      select(n, n);
      return;
    }
    const kids = [...n.childNodes];
    n.replaceWith(...kids);
    if (kids.length) select(kids[0], kids[kids.length - 1]);
    return;
  }
  const span = document.createElement("span");
  span.dataset.size = dir;
  span.className = SIZE[dir];
  span.append(range.extractContents());
  range.insertNode(span);
  select(span, span);
}
