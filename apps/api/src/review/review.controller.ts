import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type AddCommentRequest,
  addCommentRequestSchema,
  type AnnotationDto,
  type CommentDto,
  type CreateAnnotationRequest,
  createAnnotationRequestSchema,
  type CreateThreadRequest,
  createThreadRequestSchema,
  type EditCommentRequest,
  editCommentRequestSchema,
  type ThreadDto,
  type ThreadListQuery,
  threadListQuerySchema,
  type UpdateThreadRequest,
  updateThreadRequestSchema,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnnotationsService } from './annotations.service';
import { ThreadsService } from './threads.service';

type Authed = NonNullable<AuthedRequest['user']>;

@Controller()
export class ReviewController {
  constructor(
    private readonly annotations: AnnotationsService,
    private readonly threads: ThreadsService,
  ) {}

  // ── Annotations ──────────────────────────────────────────────────────────

  @Post('document-versions/:versionId/annotations')
  createAnnotation(
    @CurrentUser() user: Authed,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(createAnnotationRequestSchema)) body: CreateAnnotationRequest,
  ): Promise<AnnotationDto> {
    return this.annotations.create(user.id, versionId, body);
  }

  @Get('document-versions/:versionId/annotations')
  listAnnotations(
    @CurrentUser() user: Authed,
    @Param('versionId') versionId: string,
  ): Promise<AnnotationDto[]> {
    return this.annotations.listForVersion(user.id, versionId);
  }

  @Delete('annotations/:annotationId')
  @HttpCode(204)
  deleteAnnotation(
    @CurrentUser() user: Authed,
    @Param('annotationId') annotationId: string,
  ): Promise<void> {
    return this.annotations.remove(user.id, annotationId);
  }

  // ── Threads & comments ───────────────────────────────────────────────────

  @Post('document-versions/:versionId/threads')
  createThread(
    @CurrentUser() user: Authed,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(createThreadRequestSchema)) body: CreateThreadRequest,
  ): Promise<ThreadDto> {
    return this.threads.create(user.id, versionId, body);
  }

  @Get('document-versions/:versionId/threads')
  listThreads(
    @CurrentUser() user: Authed,
    @Param('versionId') versionId: string,
    @Query(new ZodValidationPipe(threadListQuerySchema)) query: ThreadListQuery,
  ): Promise<ThreadDto[]> {
    return this.threads.list(user.id, versionId, query);
  }

  @Get('threads/:threadId')
  getThread(@CurrentUser() user: Authed, @Param('threadId') threadId: string): Promise<ThreadDto> {
    return this.threads.getById(user.id, threadId);
  }

  @Patch('threads/:threadId')
  updateThread(
    @CurrentUser() user: Authed,
    @Param('threadId') threadId: string,
    @Body(new ZodValidationPipe(updateThreadRequestSchema)) body: UpdateThreadRequest,
  ): Promise<ThreadDto> {
    return this.threads.update(user.id, threadId, body);
  }

  @Post('threads/:threadId/comments')
  addComment(
    @CurrentUser() user: Authed,
    @Param('threadId') threadId: string,
    @Body(new ZodValidationPipe(addCommentRequestSchema)) body: AddCommentRequest,
  ): Promise<ThreadDto> {
    return this.threads.addComment(user.id, threadId, body);
  }

  @Patch('comments/:commentId')
  editComment(
    @CurrentUser() user: Authed,
    @Param('commentId') commentId: string,
    @Body(new ZodValidationPipe(editCommentRequestSchema)) body: EditCommentRequest,
  ): Promise<CommentDto> {
    return this.threads.editComment(user.id, commentId, body.body);
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  deleteComment(
    @CurrentUser() user: Authed,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.threads.deleteComment(user.id, commentId);
  }
}
