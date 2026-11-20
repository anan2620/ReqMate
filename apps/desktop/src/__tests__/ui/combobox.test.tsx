import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Combobox } from "@/components/ui/combobox";

// Radix's popper measures its anchor, which jsdom does not implement.
class ResizeObserverStub {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ||= ResizeObserverStub;

const OPTIONS = ["Authorization", "Content-Type", "Content-Length", "X-Request-Id"];

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <Combobox
        value={value}
        onChange={setValue}
        options={OPTIONS}
        placeholder="Header"
        ariaLabel="Header"
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const input = () => screen.getByRole("combobox", { name: "Header" });
const listbox = () => screen.queryByRole("listbox");
const optionNames = () =>
  screen.queryAllByRole("option").map((option) => option.textContent);

describe("Combobox", () => {
  it("suggests presets that match what has been typed", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "content" } });

    expect(optionNames()).toEqual(["Content-Type", "Content-Length"]);
  });

  it("accepts a preset picked with the mouse", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "auth" } });
    fireEvent.click(screen.getByRole("option", { name: "Authorization" }));

    expect(screen.getByTestId("value")).toHaveTextContent("Authorization");
    expect(listbox()).not.toBeInTheDocument();
  });

  it("accepts a preset picked with arrow keys + Enter", () => {
    render(<Harness />);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(optionNames()).toEqual(OPTIONS);

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(screen.getByTestId("value")).toHaveTextContent("Content-Type");
    expect(listbox()).not.toBeInTheDocument();
  });

  it("closes on Escape without touching the typed text", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "cont" } });
    expect(listbox()).toBeInTheDocument();

    fireEvent.keyDown(input(), { key: "Escape" });

    expect(listbox()).not.toBeInTheDocument();
    expect(screen.getByTestId("value")).toHaveTextContent("cont");
  });

  it("lets custom headers through without opening an empty list", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "X-Tenant-Id" } });

    expect(screen.getByTestId("value")).toHaveTextContent("X-Tenant-Id");
    expect(listbox()).not.toBeInTheDocument();
  });
});
