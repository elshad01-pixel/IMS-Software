import { Injectable } from '@nestjs/common';
import { CONTENT_LIBRARY } from './content-library.data';

@Injectable()
export class ContentLibraryService {
  getLibrary() {
    return CONTENT_LIBRARY;
  }
}
