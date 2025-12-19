# Internationalization (i18n)

This project uses a custom React Context-based i18n solution with TypeScript support.

## Usage

### 1. Accessing Translations
Use the `useLanguage` hook to access the `t` function and current `locale`.

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

export function MyComponent() {
  const { t, locale } = useLanguage();
  
  return (
    <div>
      <h1>{t('header.weather')}</h1>
      <p>Current Locale: {locale}</p>
    </div>
  );
}
```

### 2. Adding Translations
Translation files are located in `src/i18n/locales/`.
1. Edit `src/i18n/locales/en.ts` (and other languages).
2. The TypeScript types in `src/i18n/dictionary.ts` will automatically enforce consistency across languages.
3. If adding a new key, you must add it to the `Dictionary` type definition in `src/i18n/dictionary.ts` first.

### 3. Adding a New Language
1. Create a new file `src/i18n/locales/fr.ts`.
2. Import and add it to the `dictionary` object in `src/i18n/dictionary.ts`.
3. Update the `Locale` type alias.
4. Add the new language to the dropdown in `src/components/layout/Header.tsx`.

## Architecture
- **State Management**: React Context (`LanguageContext`)
- **Persistence**: `localStorage` (key: `appLang`) and `document.documentElement.lang`
- **Type Safety**: Full TypeScript support for translation keys.
