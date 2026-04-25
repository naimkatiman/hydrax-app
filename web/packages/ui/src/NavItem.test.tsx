import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { NavItem, type NavItemLinkProps } from "./NavItem";

describe("<NavItem>", () => {
  it("renders a <button> by default with the label", () => {
    render(<NavItem icon={Home} label="Home" />);
    const btn = screen.getByRole("button", { name: /home/i });
    expect(btn).toBeInTheDocument();
  });

  it("renders an <a> when href is provided", () => {
    render(<NavItem icon={Home} label="Home" href="/home" />);
    const link = screen.getByRole("link", { name: /home/i });
    expect(link.getAttribute("href")).toBe("/home");
  });

  it("sets aria-current='page' when active", () => {
    render(<NavItem icon={Home} label="Home" active />);
    expect(screen.getByRole("button").getAttribute("aria-current")).toBe("page");
  });

  it("forwards onClick when provided", async () => {
    const onClick = vi.fn();
    render(<NavItem icon={Home} label="Home" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the badge when provided", () => {
    render(<NavItem icon={Home} label="Inbox" badge={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("forwards onClick on the anchor when both href and onClick are provided", async () => {
    const onClick = vi.fn();
    render(<NavItem icon={Home} label="Home" href="/home" onClick={onClick} />);
    await userEvent.click(screen.getByRole("link"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders linkComponent (e.g. react-router Link) when provided with href", () => {
    function FakeLink({ to, children, ...rest }: NavItemLinkProps) {
      return (
        <a data-testid="fake-link" data-to={to} {...rest}>
          {children}
        </a>
      );
    }
    render(
      <NavItem
        icon={Home}
        label="Home"
        href="/home"
        linkComponent={FakeLink}
      />,
    );
    const link = screen.getByTestId("fake-link");
    expect(link.getAttribute("data-to")).toBe("/home");
    expect(link.textContent).toContain("Home");
  });
});
