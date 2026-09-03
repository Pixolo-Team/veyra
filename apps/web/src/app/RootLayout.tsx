import { Outlet, useRouterState } from '@tanstack/react-router';
import { Spin } from 'antd';

/** Root frame: the route outlet plus one honest pending state. */
export function RootLayout() {
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' });

  return (
    <>
      {isLoading ? (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            insetInlineStart: 0,
            insetBlockStart: 0,
            width: '100%',
            height: 2,
            background: 'var(--ant-color-primary, #4b5bdc)',
            opacity: 0.9,
            zIndex: 2000,
            animation: 'veyra-indeterminate 1s ease-in-out infinite',
          }}
        />
      ) : null}
      <Outlet />
    </>
  );
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Spin size="large" tip={label}>
        <div style={{ width: 120, height: 60 }} />
      </Spin>
    </div>
  );
}
