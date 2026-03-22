import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import {
  NcrActivityItem,
  NcrComment,
  NcrFilters,
  NcrRecord,
  NcrUpsertPayload
} from './ncr.models';

@Injectable({ providedIn: 'root' })
export class NcrApiService {
  private readonly api = inject(ApiService);

  list(filters: NcrFilters = {}) {
    const query = new URLSearchParams();
    if (filters.search?.trim()) query.set('search', filters.search.trim());
    if (filters.status) query.set('status', filters.status);
    if (filters.category) query.set('category', filters.category);
    if (filters.source) query.set('source', filters.source);
    if (filters.severity) query.set('severity', filters.severity);
    if (filters.ownerUserId) query.set('ownerUserId', filters.ownerUserId);
    return this.api.get<NcrRecord[]>(`ncr${query.size ? `?${query.toString()}` : ''}`);
  }

  get(id: string) {
    return this.api.get<NcrRecord>(`ncr/${id}`);
  }

  create(payload: NcrUpsertPayload) {
    return this.api.post<NcrRecord>('ncr', payload);
  }

  update(id: string, payload: Partial<NcrUpsertPayload>) {
    return this.api.patch<NcrRecord>(`ncr/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`ncr/${id}`);
  }

  listComments(id: string) {
    return this.api.get<NcrComment[]>(`ncr/${id}/comments`);
  }

  addComment(id: string, message: string) {
    return this.api.post<NcrComment>(`ncr/${id}/comments`, { message });
  }

  activity(id: string) {
    return this.api.get<NcrActivityItem[]>(`ncr/${id}/activity`);
  }
}
