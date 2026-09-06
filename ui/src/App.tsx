/**
 * The console shell: Cloudscape AppLayout with a side navigation and the two
 * pages ADR-003 specifies.
 *
 * Navigation is local state rather than a router — two pages do not justify a
 * dependency, and the server's SPA fallback serves the shell for any path.
 */
import { useState } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import Overview from "./pages/Overview.js";
import Tools from "./pages/Tools.js";
import type { FrankClient } from "./frank/types.js";

export type PageId = "overview" | "tools";

const PAGES: { id: PageId; href: string; text: string }[] = [
  { id: "overview", href: "#/overview", text: "Overview" },
  { id: "tools", href: "#/tools", text: "Tools" },
];

interface AppProps {
  client: FrankClient;
  initialPage?: PageId;
}

export default function App({ client, initialPage = "overview" }: AppProps) {
  const [page, setPage] = useState<PageId>(initialPage);

  return (
    <AppLayout
      contentType="default"
      toolsHide
      navigation={
        <SideNavigation
          header={{ href: "#/overview", text: "Frank" }}
          activeHref={PAGES.find((entry) => entry.id === page)?.href}
          items={PAGES.map((entry) => ({ type: "link", text: entry.text, href: entry.href }))}
          onFollow={(event) => {
            event.preventDefault();
            const target = PAGES.find((entry) => entry.href === event.detail.href);
            if (target) setPage(target.id);
          }}
        />
      }
      content={page === "overview" ? <Overview client={client} /> : <Tools client={client} />}
    />
  );
}
