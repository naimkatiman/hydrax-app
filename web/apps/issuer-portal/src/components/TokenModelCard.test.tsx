import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TokenModelCard } from "./TokenModelCard";

afterEach(cleanup);

describe("TokenModelCard", () => {
  it("renders the template name and stakeholder count", () => {
    render(
      <TokenModelCard
        templateName="ShortDurationCreditNote"
        stakeholders={["Issuer", "Distributor", "Investor", "Custodian"]}
        lifecycleStates={["pending", "approved", "active", "matured", "cancelled"]}
        offLedgerFields={["KYC docs", "marketing collateral", "fee schedule"]}
      />,
    );
    expect(screen.getByText("ShortDurationCreditNote")).toBeTruthy();
    expect(screen.getByText(/4 stakeholders/i)).toBeTruthy();
    expect(screen.getByText("pending")).toBeTruthy();
    expect(screen.getByText("matured")).toBeTruthy();
    expect(screen.getByText(/KYC docs/)).toBeTruthy();
  });

  it("marks terminal states distinctly", () => {
    render(
      <TokenModelCard
        templateName="X"
        stakeholders={["A"]}
        lifecycleStates={["pending", "matured", "cancelled"]}
        offLedgerFields={[]}
      />,
    );
    const matured = screen.getByText("matured");
    expect(matured.getAttribute("data-terminal")).toBe("true");
  });
});
