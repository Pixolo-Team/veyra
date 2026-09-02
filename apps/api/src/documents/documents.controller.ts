import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type DocumentDetail,
  type MoveDocumentRequest,
  moveDocumentRequestSchema,
  type RenameRequest,
  renameRequestSchema,
  uploadDocumentFieldsSchema,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DocumentsService } from './documents.service';

type Authed = NonNullable<AuthedRequest['user']>;
// mvp-plan §2: 250 MB per file.
const MAX_FILE_BYTES = 250 * 1024 * 1024;
type UploadedMulterFile = { originalname: string; mimetype: string; buffer: Buffer };

function requireFile(file: UploadedMulterFile | undefined): UploadedMulterFile {
  if (!file) throw new BadRequestException('A file is required');
  return file;
}

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('rooms/:roomId/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  upload(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() body: Record<string, string>,
  ): Promise<DocumentDetail> {
    const fields = uploadDocumentFieldsSchema.parse(body);
    return this.documents.upload(user.id, roomId, { ...fields, file: requireFile(file) });
  }

  @Post('documents/:documentId/versions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  addVersion(
    @CurrentUser() user: Authed,
    @Param('documentId') documentId: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ): Promise<DocumentDetail> {
    return this.documents.addVersion(user.id, documentId, requireFile(file));
  }

  @Get('documents/:documentId')
  get(@CurrentUser() user: Authed, @Param('documentId') documentId: string): Promise<DocumentDetail> {
    return this.documents.get(user.id, documentId);
  }

  @Patch('documents/:documentId')
  @HttpCode(204)
  rename(
    @CurrentUser() user: Authed,
    @Param('documentId') documentId: string,
    @Body(new ZodValidationPipe(renameRequestSchema)) body: RenameRequest,
  ): Promise<void> {
    return this.documents.rename(user.id, documentId, body.name);
  }

  @Patch('documents/:documentId/move')
  @HttpCode(204)
  move(
    @CurrentUser() user: Authed,
    @Param('documentId') documentId: string,
    @Body(new ZodValidationPipe(moveDocumentRequestSchema)) body: MoveDocumentRequest,
  ): Promise<void> {
    return this.documents.move(user.id, documentId, body);
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  remove(@CurrentUser() user: Authed, @Param('documentId') documentId: string): Promise<void> {
    return this.documents.softDelete(user.id, documentId);
  }

  @Get('document-versions/:versionId/content')
  content(
    @CurrentUser() user: Authed,
    @Param('versionId') versionId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.documents.contentUrl(user.id, versionId);
  }

  @Get('document-versions/:versionId/download')
  download(
    @CurrentUser() user: Authed,
    @Param('versionId') versionId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.documents.downloadUrl(user.id, versionId);
  }
}
