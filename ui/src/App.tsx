// The app shell. Cloudscape only, no custom CSS beyond layout glue (ADR-003).
import { useState } from 'react';
import {
  AppLayout,
  ContentLayout,
  Header,
  SideNavigation,
  SpaceBetween,
} from '@cloudscape-design/components';
import { Overview } from './pages/Overview';
import { Tools } from './pages/Tools';

type Page = 'overview' | 'tools';

export function App() {
  const [page, setPage] = useState<Page>('overview');

  return (
    <AppLayout
      navigationHide={false}
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
            <SpaceBetween size="m">
              <Header
                variant="h1"
                description="An MCP server that observes his own environment. He reads; he does not act."
              >
                {page === 'overview' ? 'Overview' : 'Tools'}
              </Header>
            </SpaceBetween>
          }
        >
          {page === 'overview' ? <Overview /> : <Tools />}
        </ContentLayout>
      }
    />
  );
}
