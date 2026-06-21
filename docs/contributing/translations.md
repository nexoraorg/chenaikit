# Internationalization (i18n) Guide

This guide covers how to contribute translations and work with the internationalization system in ChenAIKit.

## Overview

ChenAIKit uses [react-i18next](https://react.i18next.com/) for internationalization, providing a robust and flexible solution for multi-language support.

## Supported Languages

Currently supported languages:
- **English (en)** - Default language
- **Spanish (es)** - Español
- **Chinese (zh)** - 中文

## Translation Files

Translation files are located in `frontend/src/locales/`:
```
frontend/src/locales/
├── en.json          # English (default)
├── es.json          # Spanish
└── zh.json          # Chinese
```

## Translation Structure

Each translation file is organized into logical namespaces:

```json
{
  "app": {
    "title": "ChenAIKit",
    "description": "App description"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "transactions": "Transactions"
  },
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Real-time monitoring overview"
  },
  "errors": {
    "networkError": "Network error occurred",
    "serverError": "Server error occurred"
  }
}
```

## Adding a New Language

### 1. Create Translation File

Create a new JSON file in `frontend/src/locales/` with the appropriate language code (e.g., `fr.json` for French).

### 2. Add Language Configuration

Update `frontend/src/i18n/config.ts`:

```typescript
import fr from '../locales/fr.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  fr: { translation: fr }  // Add new language
};

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false }  // Add new language
];
```

### 3. Translate All Keys

Copy the structure from `en.json` and translate all values while maintaining the same keys.

## Translation Guidelines

### 1. Key Naming

- Use camelCase for keys
- Organize keys into logical namespaces
- Keep keys descriptive but concise
- Use consistent naming patterns

### 2. Translation Best Practices

- **Maintain Key Structure**: Never change keys when updating translations
- **Context Matters**: Consider the context where the text will appear
- **Consistency**: Use consistent terminology throughout translations
- **Cultural Adaptation**: Adapt translations for cultural context, not just literal translation
- **Character Limits**: Consider UI space constraints (especially for buttons and labels)

### 3. Pluralization

Use ICU message format for pluralization:

```json
{
  "messages": {
    "zero": "No messages",
    "one": "One message",
    "other": "{{count}} messages"
  }
}
```

Usage in React:
```tsx
const { t } = useTranslation();
t('messages', { count: messageCount });
```

### 4. Variables

Use double curly braces for variables:

```json
{
  "welcome": "Welcome, {{name}}!",
  "items": "You have {{count}} items"
}
```

### 5. HTML Formatting

For rich text, maintain HTML structure:

```json
{
  "formatted": "Welcome to <strong>ChenAIKit</strong>, the best platform for <em>blockchain monitoring</em>."
}
```

## Using Translations in Components

### 1. Basic Usage

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.subtitle')}</p>
    </div>
  );
}
```

### 2. With Variables

```tsx
const message = t('welcome', { name: 'John' });
```

### 3. Pluralization

```tsx
const message = t('messages', { count: messageCount });
```

### 4. Date/Number Formatting

```tsx
import { formatCurrency, formatDate } from '../i18n/config';

const price = formatCurrency(1000, 'USD');
const date = formatDate(new Date());
```

## Language Switcher

The application includes a flexible language switcher component:

```tsx
import LanguageSwitcher from '../components/LanguageSwitcher';

// Different variants
<LanguageSwitcher variant="select" />
<LanguageSwitcher variant="chip" />
<LanguageSwitcher variant="avatar" />
<LanguageSwitcher variant="compact" />
```

## RTL (Right-to-Left) Support

For RTL languages (Arabic, Hebrew, etc.):

### 1. Configure Language

```typescript
{
  code: 'ar',
  name: 'Arabic',
  nativeName: 'العربية',
  flag: '🇸🇦',
  rtl: true  // Enable RTL
}
```

### 2. CSS Support

The system automatically applies RTL direction:

```css
[dir="rtl"] .component {
  /* RTL-specific styles */
}
```

## Testing Translations

### 1. Translation Coverage

Use i18next-scanner to detect missing translations:

```bash
npm run i18n:scan
```

### 2. Translation Testing

Test different languages in the application:

```bash
# Start with specific language
npm start -- --lang=es
```

## Contributing Translations

### 1. Fork the Repository

Create a fork of the ChenAIKit repository.

### 2. Create Translation Branch

```bash
git checkout -b translation/your-language-code
```

### 3. Add/Update Translations

1. Create or update the appropriate JSON file
2. Update the configuration in `config.ts`
3. Test the translations in the application

### 4. Submit Pull Request

Create a pull request with:
- Clear description of changes
- Language code and name
- Any special considerations (RTL, character sets, etc.)

## Translation Tools

### 1. i18next Scanner

Automatically detects missing translation keys:

```bash
npm install i18next-scanner
npx i18next-scanner "src/**/*.{js,jsx,ts,tsx}"
```

### 2. Translation Management Platforms

For community translations, consider using:
- **Crowdin** - Crowdsourced translation platform
- **Lokalise** - Translation management system
- **Phrase** - Translation platform for developers

### 3. VS Code Extensions

- **i18n Ally** - VS Code extension for i18n support
- **i18n-Manager** - Translation key management

## Quality Assurance

### 1. Translation Review

- Review translations for accuracy and cultural appropriateness
- Check for consistent terminology
- Verify UI layout with different text lengths
- Test special characters and encoding

### 2. Automated Testing

```typescript
// Test translation completeness
describe('Translation Coverage', () => {
  const languages = ['en', 'es', 'zh'];
  const namespaces = ['app', 'dashboard', 'transactions'];
  
  languages.forEach(lang => {
    namespaces.forEach(ns => {
      it(`should have all keys for ${lang}/${ns}`, () => {
        // Test implementation
      });
    });
  });
});
```

## Performance Considerations

### 1. Lazy Loading

Translations are loaded on-demand:

```typescript
// Automatic lazy loading with react-i18next
i18n.use(initReactI18next).init({
  react: {
    useSuspense: false
  }
});
```

### 2. Bundle Optimization

```bash
# Analyze bundle size with translations
npm run build -- --analyze
```

## Troubleshooting

### 1. Missing Translations

If you see missing translation keys:
- Check if the key exists in the translation file
- Verify the namespace is correct
- Ensure the language is properly configured

### 2. Language Not Switching

If language switching doesn't work:
- Check browser localStorage for `i18nextLng`
- Verify language detection configuration
- Ensure translation files are properly loaded

### 3. RTL Layout Issues

For RTL languages:
- Add CSS direction support
- Test layout with different text lengths
- Consider margin/padding adjustments

## Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Official Site](https://www.i18next.com/)
- [ICU Message Format](http://userguide.icu-project.org/formatparse/messages)
- [Unicode CLDR](http://cldr.unicode.org/)
- [MDN Internationalization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)

## Community

Join our translation community:
- **Discord**: #translations channel
- **GitHub**: Issues and discussions
- **Email**: translations@chenaikit.dev

Thank you for contributing to ChenAIKit's internationalization! 🌍
