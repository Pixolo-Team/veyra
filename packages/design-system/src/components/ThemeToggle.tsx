/**
 * Light / dark / system switcher.
 *
 * Three options rather than a binary toggle: a two-state switch has no way to
 * express "follow the OS", so choosing either value silently opts the user out
 * of system sync for good.
 */

import type { ReactNode } from 'react';
import { Segmented, Tooltip } from 'antd';
import { BulbOutlined, DesktopOutlined, MoonOutlined } from '@ant-design/icons';

import { useThemeMode, type ThemePreference } from '../theme/themeContext';

export interface ThemeToggleProps {
  /** Hide the labels and show icons only. @default false */
  iconOnly?: boolean;
  size?: 'small' | 'middle' | 'large';
}

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <BulbOutlined /> },
  { value: 'dark', label: 'Dark', icon: <MoonOutlined /> },
  { value: 'system', label: 'System', icon: <DesktopOutlined /> },
];

export function ThemeToggle({ iconOnly = false, size = 'middle' }: ThemeToggleProps) {
  const { preference, setPreference } = useThemeMode();

  return (
    <Segmented<ThemePreference>
      size={size}
      value={preference}
      onChange={setPreference}
      options={OPTIONS.map(({ value, label, icon }) => ({
        value,
        // A bare icon needs an accessible name; the label supplies one otherwise.
        label: iconOnly ? <Tooltip title={label}>{icon}</Tooltip> : label,
        icon: iconOnly ? undefined : icon,
        'aria-label': label,
      }))}
    />
  );
}
