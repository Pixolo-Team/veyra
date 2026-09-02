import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type CreateUploadBatchRequest,
  createUploadBatchRequestSchema,
  type UploadBatchDto,
  uploadBatchFileFieldsSchema,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UploadBatchService } from './upload-batch.service';

type Authed = NonNullable<AuthedRequest['user']>;
const MAX_FILE_BYTES = 250 * 1024 * 1024;
type UploadedMulterFile = { originalname: string; mimetype: string; buffer: Buffer };

@Controller()
export class UploadBatchController {
  constructor(private readonly batches: UploadBatchService) {}

  @Post('rooms/:roomId/upload-batches')
  create(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(createUploadBatchRequestSchema)) body: CreateUploadBatchRequest,
  ): Promise<UploadBatchDto> {
    return this.batches.create(user.id, roomId, body);
  }

  @Get('upload-batches/:batchId')
  get(@CurrentUser() user: Authed, @Param('batchId') batchId: string): Promise<UploadBatchDto> {
    return this.batches.get(user.id, batchId);
  }

  @Post('upload-batches/:batchId/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  uploadFile(
    @CurrentUser() user: Authed,
    @Param('batchId') batchId: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() body: Record<string, string>,
  ): Promise<UploadBatchDto> {
    if (!file) throw new BadRequestException('A file is required');
    const { relativePath } = uploadBatchFileFieldsSchema.parse(body);
    return this.batches.uploadFile(user.id, batchId, relativePath, file);
  }

  @Post('upload-batches/:batchId/complete')
  complete(@CurrentUser() user: Authed, @Param('batchId') batchId: string): Promise<UploadBatchDto> {
    return this.batches.complete(user.id, batchId);
  }
}
