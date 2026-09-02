import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateFolderRequest,
  createFolderRequestSchema,
  type MoveFolderRequest,
  moveFolderRequestSchema,
  type RenameRequest,
  renameRequestSchema,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FoldersService } from './folders.service';

type Authed = NonNullable<AuthedRequest['user']>;

@Controller()
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Post('rooms/:roomId/folders')
  create(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(createFolderRequestSchema)) body: CreateFolderRequest,
  ): Promise<{ id: string }> {
    return this.folders.create(user.id, roomId, body);
  }

  @Patch('folders/:folderId')
  @HttpCode(204)
  rename(
    @CurrentUser() user: Authed,
    @Param('folderId') folderId: string,
    @Body(new ZodValidationPipe(renameRequestSchema)) body: RenameRequest,
  ): Promise<void> {
    return this.folders.rename(user.id, folderId, body.name);
  }

  @Patch('folders/:folderId/move')
  @HttpCode(204)
  move(
    @CurrentUser() user: Authed,
    @Param('folderId') folderId: string,
    @Body(new ZodValidationPipe(moveFolderRequestSchema)) body: MoveFolderRequest,
  ): Promise<void> {
    return this.folders.move(user.id, folderId, body.parentFolderId);
  }

  @Delete('folders/:folderId')
  @HttpCode(204)
  remove(@CurrentUser() user: Authed, @Param('folderId') folderId: string): Promise<void> {
    return this.folders.softDelete(user.id, folderId);
  }
}
