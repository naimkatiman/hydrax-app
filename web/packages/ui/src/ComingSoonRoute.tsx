import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";
import { EmptyState } from "./EmptyState";

interface ComingSoonRouteProps {
  readonly title?: string;
}

export function ComingSoonRoute({ title = "Not yet implemented" }: ComingSoonRouteProps) {
  const { pathname } = useLocation();
  return (
    <EmptyState
      icon={Construction}
      iconLabel="Construction"
      title={title}
      body={
        <>
          The route <code>{pathname}</code> is on the roadmap but not yet wired up.
          Pick another item from the sidebar.
        </>
      }
    />
  );
}
