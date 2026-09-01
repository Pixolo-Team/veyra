import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Storybook phones home with anonymous usage data by default; opt out.
  core: { disableTelemetry: true },
  typescript: {
    // Reads prop types and JSDoc off our components for the Docs tab.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      // Without this, every inherited antd HTML attribute floods the props table.
      propFilter: (prop) => !/node_modules[\\/](?!antd)/.test(prop.parent?.fileName ?? ''),
    },
  },
};

export default config;
