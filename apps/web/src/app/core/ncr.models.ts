export type NcrCategory = 'PROCESS' | 'PRODUCT' | 'SERVICE' | 'SUPPLIER' | 'COMPLAINT';
export type NcrSource = 'INTERNAL' | 'CUSTOMER' | 'SUPPLIER' | 'AUDIT';
export type NcrStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'INVESTIGATION'
  | 'ACTION_IN_PROGRESS'
  | 'PENDING_VERIFICATION'
  | 'CLOSED'
  | 'ARCHIVED';
export type NcrSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NcrPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type NcrVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type NcrRcaMethod = 'FIVE_WHY' | 'FISHBONE' | 'IS_IS_NOT' | 'OTHER';

export type NcrUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type NcrRecord = {
  id: string;
  tenantId: string;
  referenceNo: string;
  title: string;
  category: NcrCategory;
  source: NcrSource;
  description: string;
  status: NcrStatus;
  severity: NcrSeverity;
  priority: NcrPriority;
  dateReported: string;
  reportedByUserId?: string | null;
  ownerUserId?: string | null;
  department?: string | null;
  location?: string | null;
  dueDate?: string | null;
  containmentAction?: string | null;
  investigationSummary?: string | null;
  rootCause?: string | null;
  rcaMethod?: NcrRcaMethod | null;
  correctiveActionSummary?: string | null;
  verificationStatus: NcrVerificationStatus;
  verifiedByUserId?: string | null;
  verificationDate?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  reportedBy?: NcrUserSummary | null;
  owner?: NcrUserSummary | null;
  verifiedBy?: NcrUserSummary | null;
  commentCount?: number;
};

export type NcrComment = {
  id: string;
  tenantId: string;
  ncrId: string;
  authorId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  author: NcrUserSummary;
};

export type NcrActivityItem = {
  id: string;
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
  createdAt: string;
};

export type NcrFilters = {
  search?: string;
  status?: NcrStatus | '';
  category?: NcrCategory | '';
  source?: NcrSource | '';
  severity?: NcrSeverity | '';
  ownerUserId?: string;
};

export type NcrUpsertPayload = {
  referenceNo: string;
  title: string;
  category: NcrCategory;
  source: NcrSource;
  description: string;
  status: NcrStatus;
  severity: NcrSeverity;
  priority: NcrPriority;
  dateReported: string;
  reportedByUserId?: string;
  ownerUserId?: string;
  department?: string;
  location?: string;
  dueDate?: string;
  containmentAction?: string;
  investigationSummary?: string;
  rootCause?: string;
  rcaMethod?: NcrRcaMethod;
  correctiveActionSummary?: string;
  verificationStatus?: NcrVerificationStatus;
  verifiedByUserId?: string;
  verificationDate?: string;
};
