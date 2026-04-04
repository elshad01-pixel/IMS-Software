import { Module } from '@nestjs/common';
import { ContentLibraryController } from './content-library.controller';
import { ContentLibraryService } from './content-library.service';

@Module({
  controllers: [ContentLibraryController],
  providers: [ContentLibraryService]
})
export class ContentLibraryModule {}
