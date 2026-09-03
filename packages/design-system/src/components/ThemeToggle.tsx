/**
 * Light / dark / system switcher.
 *
 * Three options rather than a binary toggle: a two-state switch has no way to
 * express "follow the OS", so choosing either value silently opts the user out
 * of system sync for good.
 *
 * `compact` keeps all three states but spends one slot instead of three — a
 * single button that cycles light → dark → system. It's for chrome where a
 * segmented control would out-shout everything around it, like an app header.
 */

import type { ReactNode } from 'react';
import { Button, Segmented, Tooltip } from 'antd';
import { MonitorIcon, MoonIcon, SunIcon } from '../icons';

import { useThemeMode, type ThemePreference } from '../theme/themeContext';

export interface ThemeToggleProps {
  /** Hide the labels and show icons only. Ignored when `compact`. @default false */
  iconOnly?: boolean;
  /** One cycling icon button instead of a three-option control. @default false */
  compact?: boolean;
  size?: 'small' | 'middle' | 'large';
}

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <MonitorIcon /> },
];

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

export function ThemeToggle({ iconOnly = false, compact = false, size = 'middle' }: ThemeToggleProps) {
  const { preference, setPreference } = useThemeMode();

  if (compact) {
    const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[0];
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
    const nextLabel = OPTIONS.find((option) => option.value === next)!.label;
    // The name states where you are *and* where the press goes — an icon alone
    // can't say which of three states is current.
    const description = `Theme: ${current.label}. Switch to ${nextLabel}.`;

    return (
      <Tooltip title={description}>
        <Button
          type="text"
          size={size}
          icon={current.icon}
          aria-label={description}
          onClick={() => setPreference(next)}
        />
      </Tooltip>
    );
  }

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
