import type { Decorator, Preview } from '@storybook/react-vite';

import { ThemeProvider, type ThemePreference } from '../src';
import { colorsByMode, fontFamily, fontSize, space } from '../src/tokens';

/**
 * Wraps every story in the design system's provider.
 *
 * `persist` is off so the toolbar drives the mode outright — otherwise a
 * previously stored preference would quietly win over the picker. The `key`
 * remounts on mode change so components reading the mode at mount pick it up.
 */
const withTheme: Decorator = (Story, context) => {
  const mode = (context.globals.theme ?? 'light') as ThemePreference;
  const resolved = mode === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider key={mode} defaultPreference={mode} persist={false}>
      <div
        style={{
          background: colorsByMode[resolved].bgCanvas,
          color: colorsByMode[resolved].textPrimary,
          // The package ships no global stylesheet, so the canvas sets the
          // baseline that an app's own reset would normally provide.
          fontFamily: fontFamily.sans,
          fontSize: fontSize.md,
          padding: space.xl,
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <Story />
      </div>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Design system theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    // The decorator already paints the canvas from tokens.
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    options: {
      storySort: {
        order: [
          'Foundations',
          ['Introduction', 'Colors', 'Typography', 'Spacing & Elevation', 'Contrast'],
          'Components',
        ],
      },
    },
  },
};

export default preview;
