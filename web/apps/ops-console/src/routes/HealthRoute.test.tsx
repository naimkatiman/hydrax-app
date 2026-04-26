import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import type { ReactElement } from "react";
import { HealthRoute } from "./HealthRoute";

afterEach(cleanup);

function renderWithStore(ui: ReactElement) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (gdm) => gdm().concat(hydraxApi.middleware),
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("ops-console HealthRoute", () => {
  it("renders the Platform Health heading", () => {
    renderWithStore(<HealthRoute />);
    expect(screen.getByText(/Platform Health/i)).toBeTruthy();
  });

  it("renders a Refresh button", () => {
    renderWithStore(<HealthRoute />);
    expect(screen.getByRole("button", { name: /Refresh now/i })).toBeTruthy();
  });
});
