# ChenAIKit Documentation Website

This website is built using [Docusaurus 3](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
pnpm install
```

## Local Development

```bash
pnpm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
pnpm build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

### Using SSH

```bash
USE_SSH=true pnpm deploy
```

### Not using SSH

```bash
GIT_USER=<Your GitHub username> pnpm deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

## Search

The documentation uses Algolia DocSearch for search functionality. To set up search:

1. Apply for DocSearch at https://docsearch.algolia.com/apply/
2. Once approved, update the Algolia configuration in `docusaurus.config.ts`
3. Replace `YOUR_APP_ID` and `YOUR_SEARCH_API_KEY` with your credentials

## Customization

### Theme

Edit `src/css/custom.css` to customize colors and styles.

### Logo

Replace `static/img/logo.svg` with your logo.

### Favicon

Replace `static/img/favicon.ico` with your favicon.

## Documentation Structure

```
docs/
├── getting-started.md
├── tutorials/
│   ├── first-credit-score.md
│   └── deploying-contracts.md
├── api/
│   └── core-sdk.md
├── architecture/
│   ├── overview.md
│   └── adrs/
├── troubleshooting.md
└── faq.md
```

## Adding New Documentation

1. Create a new `.md` file in the appropriate directory under `docs/`
2. Add frontmatter at the top:
   ```md
   ---
   id: my-doc
   title: My Document
   sidebar_label: My Doc
   ---
   ```
3. Update `sidebars.ts` to include the new document
4. The document will automatically appear in the sidebar

## Markdown Features

Docusaurus supports many Markdown features:

- Code blocks with syntax highlighting
- Tabs
- Admonitions (notes, warnings, tips)
- MDX (JSX in Markdown)
- Mermaid diagrams
- Math equations (with plugin)

See [Docusaurus Markdown Features](https://docusaurus.io/docs/markdown-features) for more details.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to the documentation.
