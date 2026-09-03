import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useVeyraTokens } from '@veyra/design-system';
import { viewerRoute } from '../app/router';
import { DocumentReview } from '../components/viewer/DocumentReview';
import { roomQuery } from '../lib/queries';

/**
 * The full-screen reader.
 *
 * Reading normally happens in the dossier's own middle pane, with the tree
 * still beside it — that is where people arrive from. This route exists for
 * the links that point *at a document* rather than at the dossier: a mention
 * in an email, a thread deep-link. It mounts the same component the dossier
 * does, given the whole window instead of a pane.
 */
export function Viewer() {
  const { roomId, documentId } = viewerRoute.useParams();
  const { versionId } = useSearch({ strict: false }) as { versionId?: string };
  const { colors } = useVeyraTokens();
  const navigate = useNavigate();
  const room = useQuery(roomQuery(roomId));

  return (
    <div style={{ height: '100dvh', background: colors.bgSurface }}>
      <DocumentReview
        documentId={documentId}
        versionId={versionId}
        allowDownload={Boolean(room.data?.allowDownload)}
                  companies={{
                    ...(room.data?.discloserCompany
                      ? { discloser: room.data.discloserCompany.name }
                      : {}),
                    ...(room.data?.recipientCompany
                      ? { recipient: room.data.recipientCompany.name }
                      : {}),
                  }}
        onClose={() => void navigate({ to: '/rooms/$roomId/dossier', params: { roomId } })}
      />
    </div>
  );
}
