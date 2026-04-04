export type ContextIssueType = 'INTERNAL' | 'EXTERNAL';
export type ContextIssueStatus = 'OPEN' | 'MONITORING' | 'RESOLVED' | 'ARCHIVED';
export type InterestedPartyType = 'CUSTOMER' | 'REGULATOR' | 'EMPLOYEE' | 'SUPPLIER' | 'OTHER';

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
  createdAt: string;
  updatedAt: string;
  needCount?: number;
  needs?: NeedExpectationRecord[];
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
  };
  recentIssues: ContextIssueRecord[];
};
