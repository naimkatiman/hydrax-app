import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastProvider";

function ToastTrigger({
  tone,
  message,
}: {
  readonly tone: "success" | "danger" | "info";
  readonly message: string;
}) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ tone, message })}>
      Trigger
    </button>
  );
}

describe("<Toast> + useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing on first mount", () => {
    render(
      <ToastProvider>
        <div>app</div>
      </ToastProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears when showToast is called and lives in a role=status live region", async () => {
    render(
      <ToastProvider>
        <ToastTrigger tone="success" message="Status updated to approved." />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent("Status updated to approved.");
  });

  it("auto-dismisses after the default 4000ms timeout", async () => {
    render(
      <ToastProvider>
        <ToastTrigger tone="success" message="Hello" />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Hello");
    await act(async () => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("exposes data-tone for tone-specific styling", async () => {
    render(
      <ToastProvider>
        <ToastTrigger tone="danger" message="Boom" />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    const toast = screen.getByTestId("toast-item");
    expect(toast.getAttribute("data-tone")).toBe("danger");
  });

  it("stacks multiple toasts and renders each", async () => {
    function MultiTrigger() {
      const { showToast } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            showToast({ tone: "info", message: "first" });
            showToast({ tone: "success", message: "second" });
          }}
        >
          Trigger
        </button>
      );
    }
    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    expect(screen.getAllByTestId("toast-item")).toHaveLength(2);
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("throws a descriptive error when useToast is used outside a provider", () => {
    function Orphan() {
      useToast();
      return null;
    }
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(
      /useToast must be used inside a <ToastProvider>/,
    );
    errSpy.mockRestore();
  });
});
