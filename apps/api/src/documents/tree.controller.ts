import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { type ModuleSection, moduleSectionSchema, type ModuleTree } from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TreeService } from './tree.service';

type Authed = NonNullable<AuthedRequest['user']>;
const sectionQuery = z.object({ section: moduleSectionSchema.default('dossier') });

@Controller('rooms/:roomId/tree')
export class TreeController {
  constructor(private readonly tree: TreeService) {}

  @Get()
  get(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Query(new ZodValidationPipe(sectionQuery)) query: { section: ModuleSection },
  ): Promise<ModuleTree[]> {
    return this.tree.forSection(user.id, roomId, query.section);
  }
}
