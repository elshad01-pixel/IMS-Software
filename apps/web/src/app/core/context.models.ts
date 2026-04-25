export type ContextIssueType = 'INTERNAL' | 'EXTERNAL';
export type ContextIssueStatus = 'OPEN' | 'MONITORING' | 'RESOLVED' | 'ARCHIVED';
export type InterestedPartyType = 'CUSTOMER' | 'REGULATOR' | 'EMPLOYEE' | 'SUPPLIER' | 'OTHER';
export type SurveyHealth = 'NO_DATA' | 'ATTENTION' | 'WATCH' | 'STRONG';

export type SurveyCategoryAverage = {
  key: string;
  label: string;
  averageScore?: number | null;
  responseCount: number;
};

export type SurveySummaryRecord = {
  responseCount: number;
  openRequestCount: number;
  expiredRequestCount: number;
  averageScore?: number | null;
  lowScoreCount: number;
  mediumScoreCount: number;
  highScoreCount: number;
  health: SurveyHealth;
  categoryAverages: SurveyCategoryAverage[];
  recentComments: string[];
};

export type ContextIssueRiskLink = {
  id: string;
  riskId: string;
  title: string;
  status?: string | null;
  score?: number | null;
  path?: string | null;
  missing: boolean;
  createdAt: string;
};

export type ContextIssueProcessLink = {
  id: string;
  processId: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  path?: string | null;
  missing: boolean;
  createdAt: string;
};

export type ContextIssueRecord = {
  id: string;
  tenantId: string;
  type: ContextIssueType;
  title: string;
  description: string;
  impactOnBusiness?: string | null;
  category?: string | null;
  status: ContextIssueStatus;
  createdAt: string;
  updatedAt: string;
  linkedRiskCount?: number;
  linkedRisks?: ContextIssueRiskLink[];
  linkedProcesses?: ContextIssueProcessLink[];
};

export type InterestedPartyRecord = {
  id: string;
  tenantId: string;
  name: string;
  type: InterestedPartyType;
  description?: string | null;
  surveyEnabled?: boolean;
  surveyTitle?: string | null;
  surveyIntro?: string | null;
  surveyScaleMax?: number | null;
  surveyCategoryLabels?: string[] | null;
  createdAt: string;
  updatedAt: string;
  needCount?: number;
  needs?: NeedExpectationRecord[];
  surveySummary?: SurveySummaryRecord;
  surveyRequests?: CustomerSurveyRequestRecord[];
};

export type CustomerSurveyRequestRecord = {
  id: string;
  interestedPartyId: string;
  token: string;
  title: string;
  intro?: string | null;
  scaleMax: number;
  categoryLabels: string[];
  recipientName?: string | null;
  recipientEmail?: string | null;
  status: 'OPEN' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  sentAt?: string | null;
  expiresAt?: string | null;
  completedAt?: string | null;
  respondentName?: string | null;
  respondentEmail?: string | null;
  respondentCompany?: string | null;
  respondentReference?: string | null;
  ratings?: Record<string, number> | null;
  whatWorkedWell?: string | null;
  improvementPriority?: string | null;
  comments?: string | null;
  averageScore?: number | null;
  surveyUrl: string;
};

export type NeedExpectationRecord = {
  id: string;
  tenantId: string;
  interestedPartyId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  interestedParty?: InterestedPartyRecord | null;
};

export type ContextDashboardResponse = {
  summary: {
    internalIssues: number;
    externalIssues: number;
    interestedParties: number;
    needsExpectations: number;
    customerSurveyResponses: number;
    customerSurveyAverage?: number | null;
    customerFeedbackAttention: number;
  };
  recentIssues: ContextIssueRecord[];
  customerFeedback?: SurveySummaryRecord;
};
