import { render, screen } from "@testing-library/react";
import { StatusView } from "./api-status";

test("announces API status in a live region", () => {
  render(<StatusView state="ok" />);
  const el = screen.getByRole("status");
  expect(el).toHaveTextContent("API: collegata");
  expect(el).toHaveAttribute("aria-live", "polite");
});

test("shows unreachable text", () => {
  render(<StatusView state="down" />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "API: non raggiungibile",
  );
});
