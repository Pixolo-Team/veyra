import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { DocumentWriter } from './document-writer';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { TreeController } from './tree.controller';
import { TreeService } from './tree.service';
import { UploadBatchController } from './upload-batch.controller';
import { UploadBatchService } from './upload-batch.service';
import { WatermarkService } from './watermark.service';

@Module({
  imports: [RoomsModule],
  controllers: [TreeController, FoldersController, DocumentsController, UploadBatchController],
  providers: [
    TreeService,
    FoldersService,
    DocumentsService,
    DocumentWriter,
    UploadBatchService,
    WatermarkService,
  ],
})
export class DocumentsModule {}
