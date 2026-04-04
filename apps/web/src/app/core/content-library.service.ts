import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiService } from './api.service';
import { ContentLibraryResponse } from './content-library.models';

@Injectable({ providedIn: 'root' })
export class ContentLibraryService {
  private readonly api = inject(ApiService);
  private readonly library$ = this.api.get<ContentLibraryResponse>('content-library').pipe(shareReplay(1));

  getLibrary(): Observable<ContentLibraryResponse> {
    return this.library$;
  }
}
