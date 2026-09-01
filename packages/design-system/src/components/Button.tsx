/**
 * Button with a semantic `intent` prop.
 *
 * antd v6 splits appearance across `type`, `color`, `variant`, `danger` and
 * `ghost`, which lets any given look be spelled several ways. `intent` names
 * the *job* — primary action, destructive action, quiet action — and resolves
 * to one canonical antd combination, so the same intent looks the same
 * everywhere. Every native antd prop still passes through as an escape hatch.
 */

import { forwardRef } from 'react';
import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';

export type ButtonIntent =
  /** The one affirmative action on a screen. */
  | 'primary'
  /** Standard bordered action; the default. */
  | 'secondary'
  /** Low-emphasis action that still reads as a control. */
  | 'tertiary'
  /** Chromeless action, for toolbars and table rows. */
  | 'ghost'
  /** Destructive action — delete, revoke, cancel a subscription. */
  | 'danger'
  /** Renders inline, like an anchor. */
  | 'link';

type IntentConfig = Pick<AntButtonProps, 'color' | 'variant'>;

const INTENT_MAP: Record<ButtonIntent, IntentConfig> = {
  primary: { color: 'primary', variant: 'solid' },
  secondary: { color: 'default', variant: 'outlined' },
  tertiary: { color: 'default', variant: 'filled' },
  ghost: { color: 'default', variant: 'text' },
  danger: { color: 'danger', variant: 'solid' },
  link: { color: 'primary', variant: 'link' },
};

export interface ButtonProps extends Omit<AntButtonProps, 'type' | 'danger' | 'color' | 'variant'> {
  /** @default 'secondary' */
  intent?: ButtonIntent;
  /**
   * Uses the outlined rather than the solid form of a coloured intent.
   * Only affects `primary` and `danger`; other intents are already unfilled.
   */
  subtle?: boolean;
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button({ intent = 'secondary', subtle = false, ...rest }, ref) {
    const { color, variant } = INTENT_MAP[intent];
    const resolvedVariant = subtle && variant === 'solid' ? 'outlined' : variant;

    return <AntButton ref={ref} color={color} variant={resolvedVariant} {...rest} />;
  },
);
