import React from 'react';
import { Typography } from '@mui/material';

export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  details: React.ReactNode;
  contexts: string[];
  keywords: string[];
  section: string;
  videoUrl?: string;
}

export const helpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with ChenaiKit',
    summary: 'A quick introduction to the dashboard, navigation, and core workflows.',
    details: (
      <>
        <Typography variant="body2" paragraph>
          ChenaiKit delivers analytics, visualization, and risk monitoring in one unified interface. Start by exploring the dashboard tabs and opening the help panel from any screen.
        </Typography>
        <Typography variant="body2" paragraph>
          Use the top controls to change the time range, refresh data, and export reports. Hover over icons to reveal inline tooltips for more information.
        </Typography>
        <Typography variant="body2" paragraph>
          If you are new to the application, start the product tour to see guided onboarding with highlights and action steps.
        </Typography>
      </>
    ),
    contexts: ['general', 'dashboard'],
    keywords: ['getting started', 'tour', 'overview', 'dashboard'],
    section: 'Overview',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  },
  {
    id: 'dashboard-controls',
    title: 'Dashboard Controls and Metrics',
    summary: 'Learn how to interpret KPI cards, charts, and alert indicators.',
    details: (
      <>
        <Typography variant="body2" paragraph>
          KPI cards provide quick insight into system usage, latency, credit scores, and blockchain volume. Use them as your daily operational summary.
        </Typography>
        <Typography variant="body2" paragraph>
          Charts and graphs update based on your selected time range. The dropdown selector refreshes analytics for the last 7, 30, or 90 days.
        </Typography>
        <Typography variant="body2" paragraph>
          Export buttons create CSV or PDF reports with the currently selected timeframe and dataset.
        </Typography>
      </>
    ),
    contexts: ['dashboard', 'analytics'],
    keywords: ['metrics', 'KPI', 'charts', 'export', 'range'],
    section: 'Dashboard',
  },
  {
    id: 'visualization-tabs',
    title: 'Visualizations and Chart Modes',
    summary: 'Explore transaction flows, performance metrics, heatmaps, and network topology views.',
    details: (
      <>
        <Typography variant="body2" paragraph>
          Each tab shows a different visualization mode. Use flow charts to inspect transactions, performance panels to compare models, heatmaps to observe user activity, and network diagrams to inspect topology relationships.
        </Typography>
        <Typography variant="body2" paragraph>
          Hover over chart elements to see contextual tooltips and data details. Use export controls to download each dataset independently.
        </Typography>
      </>
    ),
    contexts: ['visualization', 'analytics'],
    keywords: ['visualization', 'flow', 'heatmap', 'network', 'performance'],
    section: 'Visualizations',
  },
  {
    id: 'help-center',
    title: 'Using the Help Center',
    summary: 'Search documentation, view FAQs, and launch guided tours from the help panel.',
    details: (
      <>
        <Typography variant="body2" paragraph>
          The help center contains searchable documentation for every major feature. Use the search box to filter topics in real time.
        </Typography>
        <Typography variant="body2" paragraph>
          Each help topic includes step-by-step instructions, links to example code, and embedded videos when available.
        </Typography>
        <Typography variant="body2" paragraph>
          If you want to learn by doing, click the "Start the product tour" button to begin an interactive walkthrough.
        </Typography>
      </>
    ),
    contexts: ['general', 'help'],
    keywords: ['help', 'support', 'search', 'tour', 'documentation'],
    section: 'Help',
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    summary: 'Answers to common questions about navigation, exports, and tooltips.',
    details: (
      <>
        <Typography variant="subtitle2" gutterBottom>
          Q: How do I export my data?</Typography>
        <Typography variant="body2" paragraph>
          A: Use the export buttons found next to the time range selector or inside visualization tabs. Choose CSV, PDF, PNG, or SVG depending on the available export options.
        </Typography>
        <Typography variant="subtitle2" gutterBottom>
          Q: What should I do if analytics do not refresh?</Typography>
        <Typography variant="body2" paragraph>
          A: Verify that the backend is running, then refresh the page or click the refresh button in the action bar.
        </Typography>
        <Typography variant="subtitle2" gutterBottom>
          Q: Can I skip the guided tour?</Typography>
        <Typography variant="body2" paragraph>
          A: Yes. The tour includes a "Skip" button and it can be launched again later from the help panel.
        </Typography>
      </>
    ),
    contexts: ['general', 'help'],
    keywords: ['FAQ', 'questions', 'export', 'refresh', 'tour'],
    section: 'Help',
  },
];
