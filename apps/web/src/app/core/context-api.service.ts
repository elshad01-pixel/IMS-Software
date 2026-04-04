import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ContextDashboardResponse, ContextIssueProcessLink, ContextIssueRecord, ContextIssueRiskLink, InterestedPartyRecord, NeedExpectationRecord } from './context.models';

@Injectable({ providedIn: 'root' })
export class ContextApiService {
  private readonly api = inject(ApiService);

  dashboard() {
    return this.api.get<ContextDashboardResponse>('context/dashboard');
  }

  listIssues(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.api.get<ContextIssueRecord[]>(`context/issues${query}`);
  }

  getIssue(id: string) {
    return this.api.get<ContextIssueRecord>(`context/issues/${id}`);
  }

  createIssue(payload: Partial<ContextIssueRecord>) {
    return this.api.post<ContextIssueRecord>('context/issues', payload);
  }

  updateIssue(id: string, payload: Partial<ContextIssueRecord>) {
    return this.api.patch<ContextIssueRecord>(`context/issues/${id}`, payload);
  }

  removeIssue(id: string) {
    return this.api.delete<{ success: boolean }>(`context/issues/${id}`);
  }

  listIssueRiskLinks(id: string) {
    return this.api.get<ContextIssueRiskLink[]>(`context/issues/${id}/risk-links`);
  }

  addIssueRiskLink(id: string, riskId: string) {
    return this.api.post<ContextIssueRiskLink>(`context/issues/${id}/risk-links`, { riskId });
  }

  removeIssueRiskLink(id: string, linkId: string) {
    return this.api.delete<{ success: boolean }>(`context/issues/${id}/risk-links/${linkId}`);
  }

  listIssueProcessLinks(id: string) {
    return this.api.get<ContextIssueProcessLink[]>(`context/issues/${id}/process-links`);
  }

  addIssueProcessLink(id: string, processId: string) {
    return this.api.post<ContextIssueProcessLink>(`context/issues/${id}/process-links`, { processId });
  }

  removeIssueProcessLink(id: string, linkId: string) {
    return this.api.delete<{ success: boolean }>(`context/issues/${id}/process-links/${linkId}`);
  }

  listInterestedParties(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.api.get<InterestedPartyRecord[]>(`context/interested-parties${query}`);
  }

  getInterestedParty(id: string) {
    return this.api.get<InterestedPartyRecord>(`context/interested-parties/${id}`);
  }

  createInterestedParty(payload: Partial<InterestedPartyRecord>) {
    return this.api.post<InterestedPartyRecord>('context/interested-parties', payload);
  }

  updateInterestedParty(id: string, payload: Partial<InterestedPartyRecord>) {
    return this.api.patch<InterestedPartyRecord>(`context/interested-parties/${id}`, payload);
  }

  removeInterestedParty(id: string) {
    return this.api.delete<{ success: boolean }>(`context/interested-parties/${id}`);
  }

  listNeeds(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.api.get<NeedExpectationRecord[]>(`context/needs-expectations${query}`);
  }

  getNeed(id: string) {
    return this.api.get<NeedExpectationRecord>(`context/needs-expectations/${id}`);
  }

  createNeed(payload: Partial<NeedExpectationRecord>) {
    return this.api.post<NeedExpectationRecord>('context/needs-expectations', payload);
  }

  updateNeed(id: string, payload: Partial<NeedExpectationRecord>) {
    return this.api.patch<NeedExpectationRecord>(`context/needs-expectations/${id}`, payload);
  }

  removeNeed(id: string) {
    return this.api.delete<{ success: boolean }>(`context/needs-expectations/${id}`);
  }
}
