import type { ReactNode } from 'react';
import { Tooltip, Typography } from 'antd';
import { Stack, ThemeToggle, useVeyraTokens } from '@veyra/design-system';
import { AuthPanel } from './AuthPanel';
import { Brand } from './Brand';

/**
 * The frame every signed-out screen sits in: log in, password reset, invite
 * acceptance.
 *
 * Brand panel on the left, form on the right. Below 960px the panel steps
 * aside entirely rather than squeezing the form — a half-width column of
 * marketing is worse than none.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  width = 400,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const { colors, space } = useVeyraTokens();

  return (
    <div className="veyra-auth-split" style={{ background: colors.bgSurface }}>
      <AuthPanel />

      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: `${space.xl}px ${space['2xl']}px`,
          overflowY: 'auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.lg,
          }}
        >
          <Brand size={19} />
          <ThemeToggle compact />
        </header>

        <div
          style={{
            margin: 'auto',
            width: '100%',
            maxWidth: width,
            paddingBlock: space['3xl'],
          }}
        >
          <Stack gap="xl">
            <Stack gap="sm">
              <Typography.Title
                level={1}
                style={{ margin: 0, fontSize: 38, lineHeight: 1.15, letterSpacing: '-0.03em' }}
              >
                {title}
              </Typography.Title>
              {subtitle ? (
                <Typography.Text type="secondary" style={{ fontSize: 15 }}>
                  {subtitle}
                </Typography.Text>
              ) : null}
            </Stack>
            {children}
          </Stack>
          {footer ? (
            <div style={{ marginTop: space.xl }}>{footer}</div>
          ) : null}
        </div>

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: space.lg,
            fontSize: 13,
            color: colors.textTertiary,
          }}
        >
          <span>© {new Date().getFullYear()} Veyra</span>
          {/* TODO: point at the published policy. Rendered as a button rather
              than an <a href="#"> so it stays focusable and announced without
              pretending to be a link to nowhere. */}
          <Tooltip title="Coming soon">
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                color: colors.textTertiary,
                cursor: 'pointer',
              }}
            >
              Privacy Policy
            </button>
          </Tooltip>
        </footer>
      </main>
    </div>
  );
}
