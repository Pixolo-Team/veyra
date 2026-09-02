import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { LocalStorageService } from './local-storage.service';
// import { S3StorageService } from './s3-storage.service';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

/**
 * `StorageService` resolves to the driver named by STORAGE_DRIVER. Only `local`
 * is active today; add the `s3` branch once s3-storage.service.ts is uncommented.
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    LocalStorageService,
    {
      provide: StorageService,
      inject: [ConfigService, LocalStorageService],
      useFactory: (config: ConfigService<Env, true>, local: LocalStorageService): StorageService => {
        const driver = config.get('STORAGE_DRIVER', { infer: true });
        switch (driver) {
          case 'local':
            return local;
          // case 's3':
          //   return new S3StorageService(config);
          default:
            throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
        }
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
