import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ContentLibraryService } from './content-library.service';

@ApiTags('content-library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('content-library')
export class ContentLibraryController {
  constructor(private readonly contentLibraryService: ContentLibraryService) {}

  @Get()
  getLibrary() {
    return this.contentLibraryService.getLibrary();
  }
}
