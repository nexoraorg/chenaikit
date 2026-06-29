import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started',
        'installation',
        'quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      items: [
        'tutorials/first-credit-score',
        'tutorials/deploying-contracts',
        'tutorials/building-dashboard',
        'tutorials/fraud-detection',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/credit-scoring',
        'concepts/fraud-detection',
        'concepts/smart-contracts',
        'concepts/transaction-monitoring',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/core-sdk',
        'api/backend-api',
        'api/smart-contracts',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        {
          type: 'category',
          label: 'ADRs',
          items: [
            'architecture/adrs/001-monorepo-structure',
            'architecture/adrs/002-stellar-soroban-blockchain',
            'architecture/adrs/003-typescript-sdk-design',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/deployment',
        'guides/testing',
        'guides/security',
        'guides/performance',
      ],
    },
    {
      type: 'doc',
      id: 'troubleshooting',
      label: 'Troubleshooting',
    },
    {
      type: 'doc',
      id: 'faq',
      label: 'FAQ',
    },
    {
      type: 'doc',
      id: 'contributing',
      label: 'Contributing',
    },
  ],
};

export default sidebars;
