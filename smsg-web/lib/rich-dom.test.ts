import { expect, test } from "vitest";
import { fromDom, toggleSize, toHtml } from "./rich-dom";

const box = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
};

test("marks round-trip through the editor DOM", () => {
  const t = "Ci **aiutiamo** a *vicenda* {+qui+} {-a Givoletto-}";
  expect(fromDom(box(toHtml(t)), false)).toBe(t);
  const multi = "riga uno\n**riga** due";
  expect(fromDom(box(toHtml(multi)), true)).toBe(multi);
});

test("HTML in the text is escaped, never parsed", () => {
  const d = box(toHtml('<img src=x onerror="alert(1)"> & **ok**'));
  expect(d.querySelector("img")).toBeNull();
  expect(fromDom(d, false)).toBe('<img src=x onerror="alert(1)"> & **ok**');
});

test("browser markup (b, i, div, nbsp) becomes marks", () => {
  expect(fromDom(box("<b>uno</b>&nbsp;<i>due</i><div>tre</div>"), true)).toBe(
    "**uno** *due*\ntre",
  );
  expect(fromDom(box("uno<br>due"), false)).toBe("uno due");
  expect(fromDom(box("<script>x</script><u>sotto</u>"), false)).toBe("xsotto");
});

test("size toggle keeps the same text selected", () => {
  const root = document.createElement("div");
  root.innerHTML = "uno due";
  document.body.append(root);
  const sel = window.getSelection()!;
  const r = document.createRange();
  r.setStart(root.firstChild!, 4);
  r.setEnd(root.firstChild!, 7);
  sel.removeAllRanges();
  sel.addRange(r);
  toggleSize(root, "up");
  expect(fromDom(root, false)).toBe("uno {+due+}");
  expect(sel.toString()).toBe("due");
  toggleSize(root, "down");
  expect(fromDom(root, false)).toBe("uno {-due-}");
  expect(sel.toString()).toBe("due");
  toggleSize(root, "down");
  expect(fromDom(root, false)).toBe("uno due");
  expect(sel.toString()).toBe("due");
  root.remove();
});
