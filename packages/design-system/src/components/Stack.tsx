/**
 * Layout primitive for one-dimensional stacks.
 *
 * antd's `Flex` accepts an arbitrary `gap`, which is exactly how a 4px grid
 * erodes. `Stack` accepts only spacing-token names, so spacing stays on-system
 * by construction rather than by review.
 */

import { forwardRef } from 'react';
import { Flex } from 'antd';
import type { FlexProps } from 'antd';

import { space, type SpaceToken } from '../tokens';

export interface StackProps extends Omit<FlexProps, 'gap' | 'vertical'> {
  /** @default 'vertical' */
  direction?: 'vertical' | 'horizontal';
  /** Spacing token name — arbitrary pixel values are deliberately not accepted. @default 'md' */
  gap?: SpaceToken;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { direction = 'vertical', gap = 'md', ...rest },
  ref,
) {
  return <Flex ref={ref} vertical={direction === 'vertical'} gap={space[gap]} {...rest} />;
});
