import { BadRequestException, Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';

/**
 * Serves objects for signed URLs minted by LocalStorageService. When
 * STORAGE_DRIVER=s3 the signed URL points straight at the bucket and this route
 * is simply never hit.
 */
@SkipThrottle()
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('object')
  async object(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!(this.storage instanceof LocalStorageService)) {
      throw new NotFoundException();
    }
    if (!key || !expires || !sig || !this.storage.verify(key, Number(expires), sig)) {
      throw new BadRequestException('Invalid or expired link');
    }
    const body = await this.storage.get(key);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  }
}
