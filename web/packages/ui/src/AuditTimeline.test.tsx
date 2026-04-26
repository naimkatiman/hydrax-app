import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditTimeline, type TimelineEvent } from "./AuditTimeline";

const events: ReadonlyArray<TimelineEvent> = [
  {
    id: "1",
    action: "subscription.created",
    created_at: "2026-04-26T09:00:00Z",
    payload: { amount_minor: 25_000_000_000 },
  },
  {
    id: "2",
    action: "subscription.kyc_validated",
    created_at: "2026-04-26T09:01:30Z",
    payload: { result: "pass" },
  },
  {
    id: "3",
    action: "subscription.queued_for_approval",
    created_at: "2026-04-26T09:02:00Z",
    payload: null,
  },
];

describe("<AuditTimeline>", () => {
  it("renders one row per event with action label", () => {
    render(<AuditTimeline events={events} />);
    expect(screen.getByText("subscription.created")).toBeInTheDocument();
    expect(screen.getByText("subscription.kyc_validated")).toBeInTheDocument();
    expect(screen.getByText("subscription.queued_for_approval")).toBeInTheDocument();
  });

  it("renders an empty-state message when events list is empty", () => {
    render(<AuditTimeline events={[]} />);
    expect(screen.getByText(/no events/i)).toBeInTheDocument();
  });

  it("renders payload as inline JSON for non-null payloads", () => {
    render(<AuditTimeline events={events} />);
    expect(screen.getByText(/amount_minor/)).toBeInTheDocument();
    expect(screen.getByText(/result/)).toBeInTheDocument();
  });
});
