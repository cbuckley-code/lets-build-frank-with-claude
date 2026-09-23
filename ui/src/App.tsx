// The app shell. Cloudscape only, no second component library and no custom CSS
// beyond layout glue (ADR-003).
//
// One MCP connection is made here and handed to both pages, so the handshake
// happens once rather than per page.
import { useEffect, useState } from 'react';
import AppLayout from '@cloudscape-design/components/app-layout';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import { connect } from './mcp/client';
import { Overview } from './pages/Overview';
import { Tools } from './pages/Tools';
import type { ConnectionState, FrankClient } from './types';

type Page = 'overview' | 'tools';

export function App() {
  const [page, setPage] = useState<Page>('overview');
  const [client, setClient] = useState<FrankClient | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const connected = await connect();
        if (cancelled) return;
        setClient(connected);
        setConnection('connected');
      } catch (caught) {
        if (cancelled) return;
        setConnection('error');
        setConnectionError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout
      toolsHide
      navigation={
        <SideNavigation
          header={{ text: 'Frank', href: '#overview' }}
          activeHref={`#${page}`}
          onFollow={(event) => {
            event.preventDefault();
            setPage(event.detail.href.replace('#', '') as Page);
          }}
          items={[
            { type: 'link', text: 'Overview', href: '#overview' },
            { type: 'link', text: 'Tools', href: '#tools' },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="An MCP server that observes his own environment. He reads; he does not act."
            >
              {page === 'overview' ? 'Overview' : 'Tools'}
            </Header>
          }
        >
          {page === 'overview' ? (
            <Overview client={client} connection={connection} connectionError={connectionError} />
          ) : (
            <Tools client={client} />
          )}
        </ContentLayout>
      }
    />
  );
}
