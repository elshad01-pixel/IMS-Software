import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ContextDashboardResponse, ContextIssueProcessLink, ContextIssueRecord, ContextIssueRiskLink, CustomerSurveyRequestRecord, InterestedPartyRecord, NeedExpectationRecord } from './context.models';

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

  createCustomerSurveyRequest(
    interestedPartyId: string,
    payload: { recipientName?: string; recipientEmail?: string; expiresAt?: string }
  ) {
    return this.api.post<CustomerSurveyRequestRecord>(
      `context/interested-parties/${interestedPartyId}/survey-requests`,
      payload
    );
  }

  getPublicCustomerSurvey(token: string) {
    return this.api.get<{
      id: string;
      token: string;
      title: string;
      intro?: string | null;
      scaleMax: number;
      categoryLabels: string[];
      status: 'OPEN' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
      expiresAt?: string | null;
      completedAt?: string | null;
      partyName: string;
    }>(`public/customer-surveys/${token}`);
  }

  submitPublicCustomerSurvey(
    token: string,
    payload: {
      respondentName?: string;
      respondentEmail?: string;
      respondentCompany?: string;
      respondentReference?: string;
      ratings: Record<string, number>;
      whatWorkedWell?: string;
      improvementPriority?: string;
      comments?: string;
    }
  ) {
    return this.api.post<{ success: boolean; averageScore: number; status: string }>(
      `public/customer-surveys/${token}/submit`,
      payload
    );
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
