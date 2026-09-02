import type { Document, DocumentVersion } from '@prisma/client';
import type { DocumentVersionDto, DocumentDto } from '@veyra/contracts';

export function toVersionDto(v: DocumentVersion): DocumentVersionDto {
  return {
    id: v.id,
    versionNo: v.versionNo,
    mimeType: v.mimeType,
    byteSize: Number(v.byteSize),
    checksumSha256: v.checksumSha256,
    pageCount: v.pageCount,
    renderStatus: v.renderStatus,
    uploadedBy: v.uploadedBy,
    createdAt: v.createdAt.toISOString(),
  };
}

export function toDocumentDto(d: Document & { currentVersion: DocumentVersion | null }): DocumentDto {
  return {
    id: d.id,
    name: d.name,
    folderId: d.folderId,
    createdAt: d.createdAt.toISOString(),
    currentVersion: d.currentVersion ? toVersionDto(d.currentVersion) : null,
  };
}
