import { Alert, Drawer, Progress, Tag, Typography } from 'antd';
import { FolderIcon } from '../icons';
import { FileTypeIcon } from '../FileTypeIcon';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import type { FileState, TrackedFile, UploadTarget } from '../../lib/useUploadBatch';

const STATE_TAGS: Record<FileState, { color: string; label: string }> = {
  queued: { color: 'default', label: 'Queued' },
  uploading: { color: 'processing', label: 'Uploading' },
  ready: { color: 'success', label: 'Ready' },
  failed: { color: 'error', label: 'Failed' },
};

/**
 * Progress for one batch. Stays open while the upload runs and reports each
 * file separately, because a 500-file drop where one file fails is not a
 * failed upload — it's 499 successes and one retry (mvp-plan §5.3).
 */
export function UploadDrawer({
  target,
  files,
  isRunning,
  fatal,
  done,
  failed,
  folders,
  onRetry,
  onClose,
}: {
  target: UploadTarget | null;
  files: TrackedFile[];
  isRunning: boolean;
  fatal: string | null;
  done: number;
  failed: number;
  folders: string[];
  onRetry: () => void;
  onClose: () => void;
}) {
  const { colors, space } = useVeyraTokens();
  const total = files.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <Drawer
      open={target !== null}
      onClose={onClose}
      // antd v6 deprecated `width`; the wrapper style is how a custom size is
      // expressed now, and `size` only offers two presets.
      styles={{ wrapper: { width: 460 } }}
      title={target ? `Upload to ${target.label}` : 'Upload'}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.sm }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {isRunning ? 'Safe to close — the batch keeps going.' : ' '}
          </Typography.Text>
          <div style={{ display: 'flex', gap: space.sm }}>
            {failed > 0 ? (
              <Button intent="secondary" onClick={onRetry} loading={isRunning}>
                Retry {failed} failed
              </Button>
            ) : null}
            <Button intent="primary" onClick={onClose} disabled={isRunning && done === 0}>
              {isRunning ? 'Close' : 'Done'}
            </Button>
          </div>
        </div>
      }
    >
      <Stack gap="lg">
        {fatal ? <Alert type="error" showIcon title={fatal} /> : null}

        <Stack gap="xs">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography.Text strong>Files</Typography.Text>
            <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {done} / {total}
            </Typography.Text>
          </div>
          <Progress
            percent={percent}
            status={failed > 0 ? 'exception' : percent === 100 ? 'success' : 'active'}
            showInfo={false}
          />
        </Stack>

        {folders.length > 0 ? (
          <Stack gap="xs">
            <Typography.Text strong style={{ fontSize: 13 }}>
              Structure we’ll create
            </Typography.Text>
            <div
              style={{
                maxHeight: 132,
                overflowY: 'auto',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: space.sm,
              }}
            >
              {folders.map((folder) => (
                <div
                  key={folder}
                  style={{
                    display: 'flex',
                    gap: space.sm,
                    alignItems: 'center',
                    fontSize: 12,
                    color: colors.textSecondary,
                    paddingBlock: 2,
                    paddingInlineStart: (folder.split('/').length - 1) * 14,
                  }}
                >
                  <FolderIcon style={{ color: colors.brand }} />
                  {folder.split('/').pop()}
                </div>
              ))}
            </div>
          </Stack>
        ) : null}

        {/* Hand-rolled rather than antd's `List`, which is deprecated in v6. */}
        <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
          {files.map((file) => {
            const tag = STATE_TAGS[file.state];
            return (
              <div
                key={file.relativePath}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space.sm,
                  padding: `${space.sm}px 0`,
                  borderBottom: `1px solid ${colors.divider}`,
                }}
              >
                <FileTypeIcon name={file.relativePath} style={{ flex: '0 0 auto' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Paragraph
                    ellipsis={{ tooltip: file.relativePath }}
                    style={{ margin: 0, fontSize: 13 }}
                  >
                    {file.relativePath}
                  </Typography.Paragraph>
                  {file.error ? (
                    <Typography.Text type="danger" style={{ fontSize: 12 }}>
                      {file.error}
                    </Typography.Text>
                  ) : null}
                </div>
                <Tag color={tag.color} style={{ marginInlineEnd: 0 }}>
                  {tag.label}
                </Tag>
              </div>
            );
          })}
        </div>
      </Stack>
    </Drawer>
  );
}
