/**
 * Card with token-backed elevation.
 *
 * antd's Card offers `bordered`/`variant` and a boolean `hoverable`, but no way
 * to say "this sits two layers above the page". `elevation` maps to our shadow
 * scale, which is defined per theme — so a raised card stays legible in dark
 * mode, where a heavier shadow would simply disappear.
 */

import { forwardRef } from 'react';
import { Card as AntCard } from 'antd';
import type { CardProps as AntCardProps } from 'antd';

import { elevation, type ElevationToken } from '../tokens';
import { useThemeMode } from '../theme/themeContext';

export interface CardProps extends Omit<AntCardProps, 'variant'> {
  /** Shadow depth from the elevation scale. @default 'none' */
  elevation?: ElevationToken;
  /** Draw the outline. Turn off when elevation alone carries the separation. @default true */
  bordered?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation: level = 'none', bordered = true, style, ...rest },
  ref,
) {
  const { mode } = useThemeMode();
  const shadow = elevation[mode][level];

  return (
    <AntCard
      ref={ref}
      variant={bordered ? 'outlined' : 'borderless'}
      style={{ ...(level !== 'none' && { boxShadow: shadow }), ...style }}
      {...rest}
    />
  );
});
