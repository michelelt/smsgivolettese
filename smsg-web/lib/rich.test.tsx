import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { plain, rich } from "./rich";

const html = (s: string) => render(<p>{rich(s)}</p>).container.innerHTML;

test("bold and italic marks become strong and em", () => {
  expect(html("a **b** c *d*")).toBe(
    "<p>a <strong>b</strong> c <em>d</em></p>",
  );
  expect(html("**a *b* c**")).toBe("<p><strong>a <em>b</em> c</strong></p>");
});

test("text without marks, lone stars and HTML stay plain text", () => {
  expect(rich("nessun segno")).toBe("nessun segno");
  expect(html("5 * 3")).toBe("<p>5 * 3</p>");
  expect(html("<b>x</b> **y**")).toBe(
    "<p>&lt;b&gt;x&lt;/b&gt; <strong>y</strong></p>",
  );
});

test("size marks become relative spans", () => {
  expect(html("{+grande+} e {-piccolo-}")).toBe(
    '<p><span class="text-[1.3em]">grande</span> e <span class="text-[0.8em]">piccolo</span></p>',
  );
  expect(html("{+**forte**+}")).toBe(
    '<p><span class="text-[1.3em]"><strong>forte</strong></span></p>',
  );
});

test("plain drops the marks", () => {
  expect(plain("Via **Roma** *1* {+a+}{-b-}")).toBe("Via Roma 1 ab");
});
