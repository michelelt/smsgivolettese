import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Inline } from "./site-inline";

const setup = (format?: boolean) => {
  const onChange = vi.fn();
  render(
    <Inline
      label="slogan"
      value="Ci **aiutiamo**"
      onChange={onChange}
      max={200}
      placeholder="Slogan"
      format={format}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Modifica slogan" }));
  return { onChange, box: screen.getByRole("textbox", { name: "slogan" }) };
};

test("formatted editor shows the text live, without marks, and keeps it", () => {
  const { onChange, box } = setup();
  expect(box.textContent).toBe("Ci aiutiamo");
  expect(box.querySelector("strong")?.textContent).toBe("aiutiamo");
  fireEvent.blur(box);
  expect(onChange).not.toHaveBeenCalled(); // unchanged text is not saved again
});

test("plain editor: caret at the end, nothing selected", () => {
  const { box } = setup(false);
  const area = box as HTMLTextAreaElement;
  expect(area.value).toBe("Ci **aiutiamo**");
  expect(area.selectionStart).toBe(area.value.length);
  expect(area.selectionEnd).toBe(area.value.length);
});
