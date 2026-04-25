import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("<EmptyState>", () => {
  it("renders title as a level-2 heading", () => {
    render(<EmptyState icon={Inbox} iconLabel="Inbox" title="No items yet" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "No items yet" }),
    ).toBeInTheDocument();
  });

  it("renders the icon when no image is provided", () => {
    render(<EmptyState icon={Inbox} iconLabel="Inbox" title="Empty" />);
    expect(screen.getByLabelText("Inbox")).toBeInTheDocument();
  });

  it("renders an image (without an icon) when imageSrc is provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        iconLabel="Inbox"
        title="Empty"
        imageSrc="/empty.png"
        imageAlt="Illustration of an empty inbox"
      />,
    );
    expect(screen.getByAltText("Illustration of an empty inbox")).toBeInTheDocument();
    expect(screen.queryByLabelText("Inbox")).not.toBeInTheDocument();
  });

  it("renders body and action when provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        iconLabel="Inbox"
        title="Empty"
        body="Connect a feed to start populating this view."
        action={<button type="button">Connect</button>}
      />,
    );
    expect(
      screen.getByText("Connect a feed to start populating this view."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });
});
