import { z } from 'zod';
import { idSchema } from './common';
import { moduleSectionSchema, renderStatusSchema, uploadBatchStatusSchema } from './enums';

/**
 * Per-file upload ceiling (mvp-plan §2). It lives here because two sides need
 * it and they must not drift: the API rejects above it, and the drop zone
 * quotes it — a UI promising a limit the server won't honour is worse than no
 * limit at all.
 */
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export const documentVersionSchema = z.object({
  id: idSchema,
  versionNo: z.number().int().positive(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  checksumSha256: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  renderStatus: renderStatusSchema,
  uploadedBy: idSchema.nullable(),
  createdAt: z.string(),
});
export type DocumentVersionDto = z.infer<typeof documentVersionSchema>;

export const documentSchema = z.object({
  id: idSchema,
  name: z.string(),
  folderId: idSchema.nullable(),
  currentVersion: documentVersionSchema.nullable(),
  createdAt: z.string(),
});
export type DocumentDto = z.infer<typeof documentSchema>;

export const documentDetailSchema = documentSchema.extend({
  roomModuleId: idSchema,
  versions: z.array(documentVersionSchema),
});
export type DocumentDetail = z.infer<typeof documentDetailSchema>;

/** A node in a module's tree. Folders nest; documents are leaves. */
export interface FolderNode {
  id: string;
  name: string;
  path: string;
  folders: FolderNode[];
  documents: DocumentDto[];
}
export const folderNodeSchema: z.ZodType<FolderNode> = z.lazy(() =>
  z.object({
    id: idSchema,
    name: z.string(),
    path: z.string(),
    folders: z.array(folderNodeSchema),
    documents: z.array(documentSchema),
  }),
);

export const moduleTreeSchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  section: moduleSectionSchema,
  sortOrder: z.number().int(),
  folders: z.array(folderNodeSchema),
  documents: z.array(documentSchema), // module-root documents
});
export type ModuleTree = z.infer<typeof moduleTreeSchema>;

// ── Mutations ──────────────────────────────────────────────────────────────

export const createFolderRequestSchema = z.object({
  name: z.string().min(1).max(200),
  roomModuleId: idSchema,
  parentFolderId: idSchema.nullable().optional(),
});
export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>;

/** Multipart form fields alongside the uploaded `file`. */
export const uploadDocumentFieldsSchema = z.object({
  roomModuleId: idSchema,
  folderId: idSchema.optional(),
});
export type UploadDocumentFields = z.infer<typeof uploadDocumentFieldsSchema>;

export const renameRequestSchema = z.object({ name: z.string().min(1).max(200) });
export type RenameRequest = z.infer<typeof renameRequestSchema>;

export const moveDocumentRequestSchema = z.object({
  folderId: idSchema.nullable(),
  roomModuleId: idSchema.optional(),
});
export type MoveDocumentRequest = z.infer<typeof moveDocumentRequestSchema>;

export const moveFolderRequestSchema = z.object({
  parentFolderId: idSchema.nullable(),
});
export type MoveFolderRequest = z.infer<typeof moveFolderRequestSchema>;

// ── Folder-drop batch upload (mvp-plan §5.3) ───────────────────────────────

/** `paths` are the browser's webkitRelativePath values, declared up front so the
 *  upload drawer can preview the tree and show queued states. */
export const createUploadBatchRequestSchema = z.object({
  roomModuleId: idSchema,
  folderId: idSchema.nullable().optional(),
  paths: z.array(z.string().min(1).max(1024)).min(1).max(5000),
});
export type CreateUploadBatchRequest = z.infer<typeof createUploadBatchRequestSchema>;

/** Multipart form field alongside `file` on each per-file upload. */
export const uploadBatchFileFieldsSchema = z.object({ relativePath: z.string().min(1).max(1024) });
export type UploadBatchFileFields = z.infer<typeof uploadBatchFileFieldsSchema>;

export const uploadFileStatusSchema = z.enum([
  'queued',
  'uploading',
  'processing',
  'ready',
  'failed',
]);

export const uploadBatchFileSchema = z.object({
  relativePath: z.string(),
  status: uploadFileStatusSchema,
  error: z.string().nullable(),
  documentId: idSchema.nullable(),
});
export type UploadBatchFileDto = z.infer<typeof uploadBatchFileSchema>;

export const uploadBatchSchema = z.object({
  id: idSchema,
  status: uploadBatchStatusSchema,
  fileCount: z.number().int(),
  bytesTotal: z.number().int(),
  files: z.array(uploadBatchFileSchema),
});
export type UploadBatchDto = z.infer<typeof uploadBatchSchema>;

/**
 * How long a document was actually open.
 *
 * Sent when the reader leaves, not while they read: a heartbeat every few
 * seconds would put a row in an append-only audit log for every few seconds
 * of reading, and an auditor scrolling a year of that would never reach the
 * download that mattered. `seconds` is capped server-side, because a tab left
 * open over a weekend is not three days of reading.
 */
export const recordViewRequestSchema = z.object({
  seconds: z.number().int().min(1).max(86_400),
  /** The furthest page reached, when the reader got past the first. */
  pagesRead: z.number().int().min(1).max(100_000).optional(),
});
export type RecordViewRequest = z.infer<typeof recordViewRequestSchema>;
