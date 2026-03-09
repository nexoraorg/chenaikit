import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ChenAIKit',
  tagline: 'AI-Powered Blockchain Toolkit',
  favicon: 'img/favicon.ico',

  url: 'https://docs.chenaikit.com',
  baseUrl: '/',

  organizationName: 'nexoraorg',
  projectName: 'chenaikit',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/nexoraorg/chenaikit/tree/main/website/',
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/nexoraorg/chenaikit/tree/main/website/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/chenaikit-social-card.jpg',
    navbar: {
      title: 'ChenAIKit',
      logo: {
        alt: 'ChenAIKit Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/tutorials/first-credit-score',
          label: 'Tutorials',
          position: 'left'
        },
        {
          to: '/docs/api/core-sdk',
          label: 'API',
          position: 'left'
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/nexoraorg/chenaikit',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Tutorials',
              to: '/docs/tutorials/first-credit-score',
            },
            {
              label: 'API Reference',
              to: '/docs/api/core-sdk',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/chenaikit',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/chenaikit',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/nexoraorg/chenaikit/discussions',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/nexoraorg/chenaikit',
            },
            {
              label: 'Contributing',
              href: 'https://github.com/nexoraorg/chenaikit/blob/main/CONTRIBUTING.md',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ChenAIKit. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['rust', 'toml', 'bash', 'typescript', 'javascript', 'json'],
    },
    algolia: {
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_SEARCH_API_KEY',
      indexName: 'chenaikit',
      contextualSearch: true,
      searchParameters: {},
      searchPagePath: 'search',
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
