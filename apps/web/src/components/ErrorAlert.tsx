import { Alert } from 'antd';
import { messageOf } from '../lib/errorMessage';

export function ErrorAlert({ error, fallback }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  return <Alert type="error" showIcon title={messageOf(error, fallback)} />;
}
