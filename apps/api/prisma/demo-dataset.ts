import {
  ActionItemStatus,
  AuditChecklistResponse,
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditStatus,
  CapaStatus,
  ComplianceObligationLinkType,
  ComplianceObligationStatus,
  ContextIssueStatus,
  ContextIssueType,
  DocumentStatus,
  EnvironmentalAspectSignificance,
  EnvironmentalAspectStage,
  EnvironmentalAspectStatus,
  InterestedPartyType,
  KpiDirection,
  ManagementReviewStatus,
  NcrCategory,
  NcrPriority,
  NcrSeverity,
  NcrSource,
  NcrStatus,
  NcrVerificationStatus,
  PrismaClient,
  ProcessRegisterLinkType,
  ProcessRegisterStatus,
  RiskIssueContextType,
  RiskStatus,
  TrainingAssignmentStatus
} from '@prisma/client';
import {
  getAuditChecklistQuestionDelegate,
  getChangeRequestDelegate,
  getChangeRequestLinkDelegate,
  getEnvironmentalAspectDelegate,
  getEnvironmentalAspectLinkDelegate,
  getExternalProviderControlDelegate,
  getExternalProviderLinkDelegate,
  getHazardIdentificationDelegate,
  getHazardIdentificationLinkDelegate,
  getIncidentDelegate,
  getIncidentLinkDelegate
} from '../src/common/prisma/prisma-delegate-compat';

function toDate(value: string) {
  return new Date(value);
}

async function ensureUser(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    roleId?: string;
    passwordHash: string;
  }
) {
  return prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: params.tenantId,
        email: params.email
      }
    },
    update: {
      firstName: params.firstName,
      lastName: params.lastName,
      roleId: params.roleId,
      passwordHash: params.passwordHash
    },
    create: {
      tenantId: params.tenantId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      passwordHash: params.passwordHash,
      roleId: params.roleId
    }
  });
}

async function ensureTenantSetting(
  prisma: PrismaClient,
  tenantId: string,
  key: string,
  value: string,
  replaceIfCurrent?: string[]
) {
  const existing = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key } }
  });

  if (!existing) {
    return prisma.tenantSetting.create({ data: { tenantId, key, value } });
  }

  if (!replaceIfCurrent?.includes(existing.value)) {
    return existing;
  }

  return prisma.tenantSetting.update({
    where: { tenantId_key: { tenantId, key } },
    data: { value }
  });
}

async function ensureProcess(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    name: string;
    purpose: string;
    ownerUserId?: string;
    department: string;
    scope: string;
    inputsText: string;
    outputsText: string;
  }
) {
  return prisma.processRegister.upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      name: params.name,
      purpose: params.purpose,
      ownerUserId: params.ownerUserId,
      department: params.department,
      scope: params.scope,
      inputsText: params.inputsText,
      outputsText: params.outputsText,
      status: ProcessRegisterStatus.ACTIVE,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      name: params.name,
      purpose: params.purpose,
      ownerUserId: params.ownerUserId,
      department: params.department,
      scope: params.scope,
      inputsText: params.inputsText,
      outputsText: params.outputsText,
      status: ProcessRegisterStatus.ACTIVE
    }
  });
}

async function ensureContextIssue(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    type: ContextIssueType;
    title: string;
    description: string;
    category: string;
    status?: ContextIssueStatus;
  }
) {
  const existing = await prisma.contextIssue.findFirst({
    where: {
      tenantId: params.tenantId,
      type: params.type,
      title: params.title
    }
  });

  if (existing) {
    return prisma.contextIssue.update({
      where: { id: existing.id },
      data: {
        description: params.description,
        category: params.category,
        status: params.status ?? ContextIssueStatus.OPEN,
        deletedAt: null
      }
    });
  }

  return prisma.contextIssue.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      title: params.title,
      description: params.description,
      category: params.category,
      status: params.status ?? ContextIssueStatus.OPEN
    }
  });
}

async function ensureRisk(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    title: string;
    description: string;
    category: string;
    likelihood: number;
    severity: number;
    existingControls?: string;
    plannedMitigationActions?: string;
    residualLikelihood?: number;
    residualImpact?: number;
    issueContextType?: RiskIssueContextType;
    issueContext?: string;
    ownerId?: string;
    targetDate?: Date;
    status?: RiskStatus;
  }
) {
  const score = params.likelihood * params.severity;
  const residualScore =
    params.residualLikelihood && params.residualImpact
      ? params.residualLikelihood * params.residualImpact
      : null;
  const existing = await prisma.risk.findFirst({
    where: {
      tenantId: params.tenantId,
      title: params.title
    }
  });

  const data = {
    description: params.description,
    category: params.category,
    likelihood: params.likelihood,
    severity: params.severity,
    score,
    existingControls: params.existingControls,
    plannedMitigationActions: params.plannedMitigationActions,
    residualLikelihood: params.residualLikelihood,
    residualImpact: params.residualImpact,
    residualScore,
    issueContextType: params.issueContextType,
    issueContext: params.issueContext,
    treatmentPlan: params.plannedMitigationActions,
    treatmentSummary: params.existingControls,
    ownerId: params.ownerId,
    targetDate: params.targetDate,
    status: params.status ?? RiskStatus.OPEN,
    deletedAt: null
  };

  if (existing) {
    return prisma.risk.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.risk.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      ...data
    }
  });
}

async function ensureDocument(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    code: string;
    title: string;
    type: string;
    summary: string;
    ownerId?: string;
    effectiveDate?: Date;
    reviewDueDate?: Date;
    status?: DocumentStatus;
    changeSummary?: string;
  }
) {
  const status = params.status ?? DocumentStatus.APPROVED;
  const approvedAt = status === DocumentStatus.APPROVED ? params.effectiveDate ?? new Date() : null;
  const obsoletedAt = status === DocumentStatus.OBSOLETE ? new Date('2026-02-01') : null;

  return prisma.document.upsert({
    where: {
      tenantId_code: {
        tenantId: params.tenantId,
        code: params.code
      }
    },
    update: {
      title: params.title,
      type: params.type,
      summary: params.summary,
      ownerId: params.ownerId,
      version: 1,
      revision: 0,
      status,
      effectiveDate: params.effectiveDate,
      reviewDueDate: params.reviewDueDate,
      approvedAt,
      obsoletedAt,
      changeSummary: params.changeSummary,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      code: params.code,
      title: params.title,
      type: params.type,
      summary: params.summary,
      ownerId: params.ownerId,
      version: 1,
      revision: 0,
      status,
      effectiveDate: params.effectiveDate,
      reviewDueDate: params.reviewDueDate,
      approvedAt,
      obsoletedAt,
      changeSummary: params.changeSummary
    }
  });
}

async function ensureAudit(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    code: string;
    title: string;
    type: string;
    standard: string;
    programme?: string;
    scopeType?: string;
    scope: string;
    objectives?: string;
    criteria?: string;
    agenda?: string;
    openingMeetingNotes?: string;
    closingMeetingNotes?: string;
    leadAuditorId?: string;
    auditeeArea: string;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    summary: string;
    conclusion: string;
    recommendations: string;
    status?: AuditStatus;
  }
) {
  const status = params.status ?? AuditStatus.COMPLETED;
  const completedAt = params.completedAt ?? params.startedAt ?? params.scheduledAt;

  return prisma.audit.upsert({
    where: {
      tenantId_code: {
        tenantId: params.tenantId,
        code: params.code
      }
    },
    update: {
      title: params.title,
      type: params.type,
      standard: params.standard,
      programme: params.programme,
      scopeType: params.scopeType,
      scope: params.scope,
      objectives: params.objectives,
      criteria: params.criteria,
      agenda: params.agenda,
      openingMeetingNotes: params.openingMeetingNotes,
      closingMeetingNotes: params.closingMeetingNotes,
      leadAuditorId: params.leadAuditorId,
      auditeeArea: params.auditeeArea,
      scheduledAt: params.scheduledAt,
      startedAt: params.startedAt,
      checklistCompletedAt: completedAt,
      completedAt,
      completedByAuditorId: params.leadAuditorId,
      summary: params.summary,
      conclusion: params.conclusion,
      recommendations: params.recommendations,
      status,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      code: params.code,
      title: params.title,
      type: params.type,
      standard: params.standard,
      programme: params.programme,
      scopeType: params.scopeType,
      scope: params.scope,
      objectives: params.objectives,
      criteria: params.criteria,
      agenda: params.agenda,
      openingMeetingNotes: params.openingMeetingNotes,
      closingMeetingNotes: params.closingMeetingNotes,
      leadAuditorId: params.leadAuditorId,
      auditeeArea: params.auditeeArea,
      scheduledAt: params.scheduledAt,
      startedAt: params.startedAt,
      checklistCompletedAt: completedAt,
      completedAt,
      completedByAuditorId: params.leadAuditorId,
      summary: params.summary,
      conclusion: params.conclusion,
      recommendations: params.recommendations,
      status
    }
  });
}

async function ensureChecklistItem(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    auditId: string;
    sourceQuestionId?: string;
    clause: string;
    subclause?: string | null;
    standard: string;
    title: string;
    sortOrder: number;
    response: AuditChecklistResponse;
    notes: string;
  }
) {
  const existing = params.sourceQuestionId
    ? await prisma.auditChecklistItem.findFirst({
        where: {
          tenantId: params.tenantId,
          auditId: params.auditId,
          sourceQuestionId: params.sourceQuestionId
        }
      })
    : null;

  const data = {
    clause: params.clause,
    subclause: params.subclause,
    standard: params.standard,
    title: params.title,
    sortOrder: params.sortOrder,
    response: params.response,
    notes: params.notes,
    isComplete: true
  };

  if (existing) {
    return prisma.auditChecklistItem.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.auditChecklistItem.create({
    data: {
      tenantId: params.tenantId,
      auditId: params.auditId,
      sourceQuestionId: params.sourceQuestionId,
      ...data
    }
  });
}

async function ensureAuditFinding(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    auditId: string;
    checklistItemId?: string;
    clause?: string | null;
    title: string;
    description: string;
    severity: AuditFindingSeverity;
    ownerId?: string;
    dueDate?: Date;
    status?: AuditFindingStatus;
  }
) {
  const existing = await prisma.auditFinding.findFirst({
    where: {
      tenantId: params.tenantId,
      auditId: params.auditId,
      title: params.title
    }
  });

  const data = {
    checklistItemId: params.checklistItemId,
    clause: params.clause,
    description: params.description,
    severity: params.severity,
    ownerId: params.ownerId,
    dueDate: params.dueDate,
    status: params.status ?? AuditFindingStatus.OPEN
  };

  if (existing) {
    return prisma.auditFinding.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.auditFinding.create({
    data: {
      tenantId: params.tenantId,
      auditId: params.auditId,
      title: params.title,
      ...data
    }
  });
}

async function ensureNcr(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    title: string;
    category?: NcrCategory;
    source?: NcrSource;
    description: string;
    reportedByUserId?: string;
    ownerUserId?: string;
    department?: string;
    location?: string;
    dueDate?: Date;
    dateReported?: Date;
    severity?: NcrSeverity;
    priority?: NcrPriority;
    containmentAction?: string;
    investigationSummary?: string;
    rootCause?: string;
    correctiveActionSummary?: string;
    status?: NcrStatus;
  }
) {
  return prisma.ncr.upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      title: params.title,
      description: params.description,
      reportedByUserId: params.reportedByUserId,
      ownerUserId: params.ownerUserId,
      department: params.department,
      location: params.location,
      dueDate: params.dueDate,
      dateReported: params.dateReported,
      severity: params.severity,
      priority: params.priority,
      containmentAction: params.containmentAction,
      investigationSummary: params.investigationSummary,
      rootCause: params.rootCause,
      correctiveActionSummary: params.correctiveActionSummary,
      status: params.status ?? NcrStatus.ACTION_IN_PROGRESS,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      title: params.title,
      category: params.category ?? NcrCategory.PROCESS,
      source: params.source ?? NcrSource.AUDIT,
      description: params.description,
      severity: params.severity ?? NcrSeverity.MEDIUM,
      priority: params.priority ?? NcrPriority.HIGH,
      dateReported: params.dateReported ?? new Date(),
      reportedByUserId: params.reportedByUserId,
      ownerUserId: params.ownerUserId,
      department: params.department,
      location: params.location,
      dueDate: params.dueDate,
      containmentAction: params.containmentAction,
      investigationSummary: params.investigationSummary,
      rootCause: params.rootCause,
      correctiveActionSummary: params.correctiveActionSummary,
      verificationStatus: NcrVerificationStatus.PENDING,
      status: params.status ?? NcrStatus.ACTION_IN_PROGRESS
    }
  });
}

async function ensureCapa(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    title: string;
    source: string;
    category?: string;
    problemStatement: string;
    containmentAction?: string;
    rootCause?: string;
    correction?: string;
    correctiveAction?: string;
    preventiveAction?: string;
    verificationMethod?: string;
    closureSummary?: string;
    ownerId?: string;
    dueDate?: Date;
    closedAt?: Date;
    status?: CapaStatus;
  }
) {
  const existing = await prisma.capa.findFirst({
    where: {
      tenantId: params.tenantId,
      title: params.title
    }
  });

  const data = {
    source: params.source,
    category: params.category,
    problemStatement: params.problemStatement,
    containmentAction: params.containmentAction,
    rootCause: params.rootCause,
    correction: params.correction,
    correctiveAction: params.correctiveAction,
    preventiveAction: params.preventiveAction,
    verificationMethod: params.verificationMethod,
    closureSummary: params.closureSummary,
    ownerId: params.ownerId,
    dueDate: params.dueDate,
    closedAt: params.closedAt,
    status: params.status ?? CapaStatus.OPEN,
    deletedAt: null
  };

  if (existing) {
    return prisma.capa.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.capa.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      ...data
    }
  });
}

async function ensureInterestedParty(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    name: string;
    type: InterestedPartyType;
    description?: string;
    surveyEnabled?: boolean;
    surveyTitle?: string;
    surveyIntro?: string;
    surveyScaleMax?: number;
    surveyCategoryLabels?: unknown;
  }
) {
  const existing = await prisma.interestedParty.findFirst({
    where: {
      tenantId: params.tenantId,
      name: params.name
    }
  });

  const data = {
    type: params.type,
    description: params.description,
    surveyEnabled: params.surveyEnabled ?? false,
    surveyTitle: params.surveyTitle,
    surveyIntro: params.surveyIntro,
    surveyScaleMax: params.surveyScaleMax,
    surveyCategoryLabels: params.surveyCategoryLabels as never,
    deletedAt: null
  };

  if (existing) {
    return prisma.interestedParty.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.interestedParty.create({
    data: {
      tenantId: params.tenantId,
      name: params.name,
      ...data
    }
  });
}

async function ensureNeedExpectation(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    interestedPartyId: string;
    description: string;
  }
) {
  const existing = await prisma.needExpectation.findFirst({
    where: {
      tenantId: params.tenantId,
      interestedPartyId: params.interestedPartyId,
      description: params.description
    }
  });

  if (existing) {
    return prisma.needExpectation.update({
      where: { id: existing.id },
      data: { deletedAt: null }
    });
  }

  return prisma.needExpectation.create({
    data: {
      tenantId: params.tenantId,
      interestedPartyId: params.interestedPartyId,
      description: params.description
    }
  });
}

async function ensureKpi(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    name: string;
    description?: string;
    ownerId?: string;
    target: number;
    warningThreshold?: number;
    actual: number;
    unit: string;
    periodLabel: string;
    direction?: KpiDirection;
  }
) {
  const existing = await prisma.kpi.findFirst({
    where: {
      tenantId: params.tenantId,
      name: params.name
    }
  });

  const data = {
    description: params.description,
    ownerId: params.ownerId,
    target: params.target,
    warningThreshold: params.warningThreshold,
    actual: params.actual,
    unit: params.unit,
    periodLabel: params.periodLabel,
    direction: params.direction ?? KpiDirection.AT_LEAST
  };

  if (existing) {
    return prisma.kpi.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.kpi.create({
    data: {
      tenantId: params.tenantId,
      name: params.name,
      ...data
    }
  });
}

async function ensureKpiReading(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    kpiId: string;
    value: number;
    readingDate: Date;
    notes?: string;
  }
) {
  const existing = await prisma.kpiReading.findFirst({
    where: {
      tenantId: params.tenantId,
      kpiId: params.kpiId,
      readingDate: params.readingDate
    }
  });

  if (existing) {
    return prisma.kpiReading.update({
      where: { id: existing.id },
      data: {
        value: params.value,
        notes: params.notes
      }
    });
  }

  return prisma.kpiReading.create({
    data: {
      tenantId: params.tenantId,
      kpiId: params.kpiId,
      value: params.value,
      readingDate: params.readingDate,
      notes: params.notes
    }
  });
}

async function ensureTraining(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    title: string;
    audience?: string;
    description?: string;
    ownerId?: string;
    deliveryMethod?: string;
    dueDate?: Date;
    completion?: number;
  }
) {
  const existing = await prisma.training.findFirst({
    where: {
      tenantId: params.tenantId,
      title: params.title
    }
  });

  const data = {
    audience: params.audience,
    description: params.description,
    ownerId: params.ownerId,
    deliveryMethod: params.deliveryMethod,
    dueDate: params.dueDate,
    completion: params.completion ?? 0
  };

  if (existing) {
    return prisma.training.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.training.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      ...data
    }
  });
}

async function ensureTrainingAssignment(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    trainingId: string;
    userId: string;
    dueDate?: Date;
    completedAt?: Date;
    status?: TrainingAssignmentStatus;
    notes?: string;
    evidenceSummary?: string;
  }
) {
  return prisma.trainingAssignment.upsert({
    where: {
      trainingId_userId: {
        trainingId: params.trainingId,
        userId: params.userId
      }
    },
    update: {
      dueDate: params.dueDate,
      completedAt: params.completedAt,
      status: params.status ?? TrainingAssignmentStatus.ASSIGNED,
      notes: params.notes,
      evidenceSummary: params.evidenceSummary
    },
    create: {
      tenantId: params.tenantId,
      trainingId: params.trainingId,
      userId: params.userId,
      dueDate: params.dueDate,
      completedAt: params.completedAt,
      status: params.status ?? TrainingAssignmentStatus.ASSIGNED,
      notes: params.notes,
      evidenceSummary: params.evidenceSummary
    }
  });
}

async function ensureManagementReview(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    title: string;
    reviewDate: Date;
    chairpersonId?: string;
    agenda?: string;
    auditResults?: string;
    capaStatus?: string;
    kpiPerformance?: string;
    customerInterestedPartiesFeedback?: string;
    providerPerformance?: string;
    complianceObligations?: string;
    incidentEmergencyPerformance?: string;
    consultationCommunication?: string;
    risksOpportunities?: string;
    changesAffectingSystem?: string;
    previousActions?: string;
    minutes?: string;
    decisions?: string;
    improvementActions?: string;
    systemChangesNeeded?: string;
    objectiveTargetChanges?: string;
    resourceNeeds?: string;
    effectivenessConclusion?: string;
    summary?: string;
    status?: ManagementReviewStatus;
  }
) {
  const existing = await prisma.managementReview.findFirst({
    where: {
      tenantId: params.tenantId,
      title: params.title
    }
  });

  const data = {
    reviewDate: params.reviewDate,
    chairpersonId: params.chairpersonId,
    agenda: params.agenda,
    auditResults: params.auditResults,
    capaStatus: params.capaStatus,
    kpiPerformance: params.kpiPerformance,
    customerInterestedPartiesFeedback: params.customerInterestedPartiesFeedback,
    providerPerformance: params.providerPerformance,
    complianceObligations: params.complianceObligations,
    incidentEmergencyPerformance: params.incidentEmergencyPerformance,
    consultationCommunication: params.consultationCommunication,
    risksOpportunities: params.risksOpportunities,
    changesAffectingSystem: params.changesAffectingSystem,
    previousActions: params.previousActions,
    minutes: params.minutes,
    decisions: params.decisions,
    improvementActions: params.improvementActions,
    systemChangesNeeded: params.systemChangesNeeded,
    objectiveTargetChanges: params.objectiveTargetChanges,
    resourceNeeds: params.resourceNeeds,
    effectivenessConclusion: params.effectivenessConclusion,
    summary: params.summary,
    status: params.status ?? ManagementReviewStatus.PLANNED,
    deletedAt: null
  };

  if (existing) {
    return prisma.managementReview.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.managementReview.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      ...data
    }
  });
}

async function ensureCustomerSurveyRequest(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    interestedPartyId: string;
    token: string;
    title: string;
    intro?: string;
    scaleMax: number;
    categoryLabels: string[];
    recipientName?: string;
    recipientEmail?: string;
    respondentName?: string;
    respondentEmail?: string;
    respondentCompany?: string;
    respondentReference?: string;
    ratings?: Record<string, number>;
    whatWorkedWell?: string;
    improvementPriority?: string;
    comments?: string;
    averageScore?: number;
    status: 'OPEN' | 'COMPLETED';
    sentAt?: Date;
    completedAt?: Date;
  }
) {
  return prisma.customerSurveyRequest.upsert({
    where: { token: params.token },
    update: {
      interestedPartyId: params.interestedPartyId,
      title: params.title,
      intro: params.intro,
      scaleMax: params.scaleMax,
      categoryLabels: params.categoryLabels,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      respondentName: params.respondentName,
      respondentEmail: params.respondentEmail,
      respondentCompany: params.respondentCompany,
      respondentReference: params.respondentReference,
      ratings: params.ratings,
      whatWorkedWell: params.whatWorkedWell,
      improvementPriority: params.improvementPriority,
      comments: params.comments,
      averageScore: params.averageScore,
      status: params.status,
      sentAt: params.sentAt,
      completedAt: params.completedAt
    },
    create: {
      tenantId: params.tenantId,
      interestedPartyId: params.interestedPartyId,
      token: params.token,
      title: params.title,
      intro: params.intro,
      scaleMax: params.scaleMax,
      categoryLabels: params.categoryLabels,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      respondentName: params.respondentName,
      respondentEmail: params.respondentEmail,
      respondentCompany: params.respondentCompany,
      respondentReference: params.respondentReference,
      ratings: params.ratings,
      whatWorkedWell: params.whatWorkedWell,
      improvementPriority: params.improvementPriority,
      comments: params.comments,
      averageScore: params.averageScore,
      status: params.status,
      sentAt: params.sentAt,
      completedAt: params.completedAt
    }
  });
}

async function resetDemoOperationalData(prisma: PrismaClient, tenantId: string) {
  await prisma.$transaction([
    prisma.customerSurveyRequest.deleteMany({ where: { tenantId } }),
    prisma.needExpectation.deleteMany({ where: { tenantId } }),
    prisma.contextIssueRiskLink.deleteMany({ where: { tenantId } }),
    prisma.processRegisterLink.deleteMany({ where: { tenantId } }),
    prisma.complianceObligationLink.deleteMany({ where: { tenantId } }),
    prisma.incidentLink.deleteMany({ where: { tenantId } }),
    prisma.environmentalAspectLink.deleteMany({ where: { tenantId } }),
    prisma.hazardIdentificationLink.deleteMany({ where: { tenantId } }),
    prisma.externalProviderLink.deleteMany({ where: { tenantId } }),
    prisma.changeRequestLink.deleteMany({ where: { tenantId } }),
    prisma.ncrComment.deleteMany({ where: { tenantId } }),
    prisma.managementReviewInput.deleteMany({ where: { tenantId } }),
    prisma.trainingAssignment.deleteMany({ where: { tenantId } }),
    prisma.kpiReading.deleteMany({ where: { tenantId } }),
    prisma.auditFinding.deleteMany({ where: { tenantId } }),
    prisma.auditChecklistItem.deleteMany({ where: { tenantId } }),
    prisma.actionItem.deleteMany({ where: { tenantId } }),
    prisma.capa.deleteMany({ where: { tenantId } }),
    prisma.ncr.deleteMany({ where: { tenantId } }),
    prisma.audit.deleteMany({ where: { tenantId } }),
    prisma.managementReview.deleteMany({ where: { tenantId } }),
    prisma.kpi.deleteMany({ where: { tenantId } }),
    prisma.training.deleteMany({ where: { tenantId } }),
    prisma.document.deleteMany({ where: { tenantId } }),
    prisma.risk.deleteMany({ where: { tenantId } }),
    prisma.processRegister.deleteMany({ where: { tenantId } }),
    prisma.complianceObligation.deleteMany({ where: { tenantId } }),
    prisma.incident.deleteMany({ where: { tenantId } }),
    prisma.environmentalAspect.deleteMany({ where: { tenantId } }),
    prisma.hazardIdentification.deleteMany({ where: { tenantId } }),
    prisma.externalProviderControl.deleteMany({ where: { tenantId } }),
    prisma.changeRequest.deleteMany({ where: { tenantId } }),
    prisma.contextIssue.deleteMany({ where: { tenantId } }),
    prisma.interestedParty.deleteMany({ where: { tenantId } })
  ]);
}

async function ensureActionItem(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    sourceType: string;
    sourceId: string;
    title: string;
    description?: string;
    ownerId?: string;
    dueDate?: Date;
    status?: ActionItemStatus;
  }
) {
  const existing = await prisma.actionItem.findFirst({
    where: {
      tenantId: params.tenantId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      title: params.title
    }
  });

  const data = {
    description: params.description,
    ownerId: params.ownerId,
    dueDate: params.dueDate,
    status: params.status ?? ActionItemStatus.OPEN,
    deletedAt: null
  };

  if (existing) {
    return prisma.actionItem.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.actionItem.create({
    data: {
      tenantId: params.tenantId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      title: params.title,
      ...data
    }
  });
}

async function ensureProcessLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    processId: string;
    linkType: ProcessRegisterLinkType;
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return prisma.processRegisterLink.upsert({
    where: {
      processId_linkType_linkedId: {
        processId: params.processId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      processId: params.processId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureComplianceObligation(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    title: string;
    sourceName: string;
    obligationType?: string;
    jurisdiction?: string;
    description?: string;
    ownerUserId?: string;
    reviewFrequencyMonths?: number;
    nextReviewDate?: Date;
    status?: ComplianceObligationStatus;
  }
) {
  return prisma.complianceObligation.upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      title: params.title,
      sourceName: params.sourceName,
      obligationType: params.obligationType,
      jurisdiction: params.jurisdiction,
      description: params.description,
      ownerUserId: params.ownerUserId,
      reviewFrequencyMonths: params.reviewFrequencyMonths,
      nextReviewDate: params.nextReviewDate,
      status: params.status ?? ComplianceObligationStatus.ACTIVE,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      title: params.title,
      sourceName: params.sourceName,
      obligationType: params.obligationType,
      jurisdiction: params.jurisdiction,
      description: params.description,
      ownerUserId: params.ownerUserId,
      reviewFrequencyMonths: params.reviewFrequencyMonths,
      nextReviewDate: params.nextReviewDate,
      status: params.status ?? ComplianceObligationStatus.ACTIVE
    }
  });
}

async function ensureComplianceObligationLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    obligationId: string;
    linkType: ComplianceObligationLinkType;
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return prisma.complianceObligationLink.upsert({
    where: {
      obligationId_linkType_linkedId: {
        obligationId: params.obligationId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      obligationId: params.obligationId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureIncident(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    title: string;
    type: 'INCIDENT' | 'NEAR_MISS';
    category: 'SAFETY' | 'ENVIRONMENT' | 'QUALITY' | 'SECURITY' | 'OTHER';
    description: string;
    eventDate: Date;
    location?: string;
    ownerUserId?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    immediateAction?: string;
    investigationSummary?: string;
    rootCause?: string;
    rcaMethod?: 'FIVE_WHY' | 'FISHBONE' | 'IS_IS_NOT' | 'OTHER';
    correctiveActionSummary?: string;
    status?: 'REPORTED' | 'INVESTIGATION' | 'ACTION_IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';
  }
) {
  return (getIncidentDelegate(prisma) as any).upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      title: params.title,
      type: params.type,
      category: params.category,
      description: params.description,
      eventDate: params.eventDate,
      location: params.location,
      ownerUserId: params.ownerUserId,
      severity: params.severity,
      immediateAction: params.immediateAction,
      investigationSummary: params.investigationSummary,
      rootCause: params.rootCause,
      rcaMethod: params.rcaMethod,
      correctiveActionSummary: params.correctiveActionSummary,
      status: params.status ?? 'INVESTIGATION',
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      title: params.title,
      type: params.type,
      category: params.category,
      description: params.description,
      eventDate: params.eventDate,
      location: params.location,
      ownerUserId: params.ownerUserId,
      severity: params.severity,
      immediateAction: params.immediateAction,
      investigationSummary: params.investigationSummary,
      rootCause: params.rootCause,
      rcaMethod: params.rcaMethod,
      correctiveActionSummary: params.correctiveActionSummary,
      status: params.status ?? 'INVESTIGATION'
    }
  });
}

async function ensureIncidentLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    incidentId: string;
    linkType: 'PROCESS' | 'RISK' | 'ACTION';
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return (getIncidentLinkDelegate(prisma) as any).upsert({
    where: {
      incidentId_linkType_linkedId: {
        incidentId: params.incidentId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      incidentId: params.incidentId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureEnvironmentalAspect(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    activity: string;
    aspect: string;
    impact: string;
    lifecycleStage: EnvironmentalAspectStage;
    controlSummary?: string;
    significance: EnvironmentalAspectSignificance;
    ownerUserId?: string;
    reviewDate?: Date;
    status?: EnvironmentalAspectStatus;
  }
) {
  return (getEnvironmentalAspectDelegate(prisma) as any).upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      activity: params.activity,
      aspect: params.aspect,
      impact: params.impact,
      lifecycleStage: params.lifecycleStage,
      controlSummary: params.controlSummary,
      significance: params.significance,
      ownerUserId: params.ownerUserId,
      reviewDate: params.reviewDate,
      status: params.status ?? EnvironmentalAspectStatus.ACTIVE,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      activity: params.activity,
      aspect: params.aspect,
      impact: params.impact,
      lifecycleStage: params.lifecycleStage,
      controlSummary: params.controlSummary,
      significance: params.significance,
      ownerUserId: params.ownerUserId,
      reviewDate: params.reviewDate,
      status: params.status ?? EnvironmentalAspectStatus.ACTIVE
    }
  });
}

async function ensureEnvironmentalAspectLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    aspectId: string;
    linkType: 'PROCESS' | 'RISK' | 'ACTION';
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return (getEnvironmentalAspectLinkDelegate(prisma) as any).upsert({
    where: {
      aspectId_linkType_linkedId: {
        aspectId: params.aspectId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      aspectId: params.aspectId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureHazardIdentification(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    activity: string;
    hazard: string;
    potentialHarm: string;
    exposureStage: 'ROUTINE' | 'NON_ROUTINE' | 'EMERGENCY';
    existingControls?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    ownerUserId?: string;
    reviewDate?: Date;
    status?: 'ACTIVE' | 'MONITORING' | 'OBSOLETE';
  }
) {
  return (getHazardIdentificationDelegate(prisma) as any).upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      activity: params.activity,
      hazard: params.hazard,
      potentialHarm: params.potentialHarm,
      exposureStage: params.exposureStage,
      existingControls: params.existingControls,
      severity: params.severity,
      ownerUserId: params.ownerUserId,
      reviewDate: params.reviewDate,
      status: params.status ?? 'ACTIVE',
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      activity: params.activity,
      hazard: params.hazard,
      potentialHarm: params.potentialHarm,
      exposureStage: params.exposureStage,
      existingControls: params.existingControls,
      severity: params.severity,
      ownerUserId: params.ownerUserId,
      reviewDate: params.reviewDate,
      status: params.status ?? 'ACTIVE'
    }
  });
}

async function ensureHazardIdentificationLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    hazardId: string;
    linkType: 'PROCESS' | 'RISK' | 'ACTION' | 'INCIDENT';
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return (getHazardIdentificationLinkDelegate(prisma) as any).upsert({
    where: {
      hazardId_linkType_linkedId: {
        hazardId: params.hazardId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      hazardId: params.hazardId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureExternalProvider(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    providerName: string;
    providerType: 'SUPPLIER' | 'OUTSOURCED_SERVICE' | 'CONTRACTOR' | 'CALIBRATION' | 'LOGISTICS' | 'OTHER';
    suppliedScope: string;
    approvalBasis?: string;
    criticality: 'LOW' | 'MEDIUM' | 'HIGH';
    ownerUserId?: string;
    evaluationDate?: Date;
    qualityScore?: number;
    deliveryScore?: number;
    responsivenessScore?: number;
    complianceScore?: number;
    traceabilityScore?: number;
    changeControlScore?: number;
    evaluationScore?: number;
    evaluationOutcome?: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'ESCALATED' | 'DISQUALIFIED';
    evaluationSummary?: string;
    nextReviewDate?: Date;
    status?: 'APPROVED' | 'CONDITIONAL' | 'UNDER_REVIEW' | 'INACTIVE';
  }
) {
  return (getExternalProviderControlDelegate(prisma) as any).upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      providerName: params.providerName,
      providerType: params.providerType,
      suppliedScope: params.suppliedScope,
      approvalBasis: params.approvalBasis,
      criticality: params.criticality,
      ownerUserId: params.ownerUserId,
      evaluationDate: params.evaluationDate,
      qualityScore: params.qualityScore,
      deliveryScore: params.deliveryScore,
      responsivenessScore: params.responsivenessScore,
      complianceScore: params.complianceScore,
      traceabilityScore: params.traceabilityScore,
      changeControlScore: params.changeControlScore,
      evaluationScore: params.evaluationScore,
      evaluationOutcome: params.evaluationOutcome,
      evaluationSummary: params.evaluationSummary,
      nextReviewDate: params.nextReviewDate,
      status: params.status ?? 'APPROVED',
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      providerName: params.providerName,
      providerType: params.providerType,
      suppliedScope: params.suppliedScope,
      approvalBasis: params.approvalBasis,
      criticality: params.criticality,
      ownerUserId: params.ownerUserId,
      evaluationDate: params.evaluationDate,
      qualityScore: params.qualityScore,
      deliveryScore: params.deliveryScore,
      responsivenessScore: params.responsivenessScore,
      complianceScore: params.complianceScore,
      traceabilityScore: params.traceabilityScore,
      changeControlScore: params.changeControlScore,
      evaluationScore: params.evaluationScore,
      evaluationOutcome: params.evaluationOutcome,
      evaluationSummary: params.evaluationSummary,
      nextReviewDate: params.nextReviewDate,
      status: params.status ?? 'APPROVED'
    }
  });
}

async function ensureExternalProviderLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    providerId: string;
    linkType: 'PROCESS' | 'RISK' | 'AUDIT' | 'ACTION' | 'OBLIGATION';
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return (getExternalProviderLinkDelegate(prisma) as any).upsert({
    where: {
      providerId_linkType_linkedId: {
        providerId: params.providerId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      providerId: params.providerId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureChangeRequest(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    title: string;
    changeType: 'PROCESS' | 'PRODUCT' | 'EQUIPMENT' | 'MATERIAL' | 'ORGANIZATIONAL' | 'DOCUMENTATION' | 'FACILITY' | 'OTHER';
    reason: string;
    affectedArea: string;
    proposedChange: string;
    impactSummary?: string;
    controlSummary?: string;
    ownerUserId?: string;
    targetImplementationDate?: Date;
    reviewDate?: Date;
    status?: 'PROPOSED' | 'REVIEWING' | 'APPROVED' | 'IMPLEMENTING' | 'VERIFIED' | 'CLOSED' | 'REJECTED';
  }
) {
  return (getChangeRequestDelegate(prisma) as any).upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      title: params.title,
      changeType: params.changeType,
      reason: params.reason,
      affectedArea: params.affectedArea,
      proposedChange: params.proposedChange,
      impactSummary: params.impactSummary,
      controlSummary: params.controlSummary,
      ownerUserId: params.ownerUserId,
      targetImplementationDate: params.targetImplementationDate,
      reviewDate: params.reviewDate,
      status: params.status ?? 'REVIEWING',
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      title: params.title,
      changeType: params.changeType,
      reason: params.reason,
      affectedArea: params.affectedArea,
      proposedChange: params.proposedChange,
      impactSummary: params.impactSummary,
      controlSummary: params.controlSummary,
      ownerUserId: params.ownerUserId,
      targetImplementationDate: params.targetImplementationDate,
      reviewDate: params.reviewDate,
      status: params.status ?? 'REVIEWING'
    }
  });
}

async function ensureChangeRequestLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    changeId: string;
    linkType: 'PROCESS' | 'RISK' | 'ACTION' | 'DOCUMENT' | 'OBLIGATION' | 'PROVIDER';
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return (getChangeRequestLinkDelegate(prisma) as any).upsert({
    where: {
      changeId_linkType_linkedId: {
        changeId: params.changeId,
        linkType: params.linkType,
        linkedId: params.linkedId
      }
    },
    update: {
      note: params.note,
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      changeId: params.changeId,
      linkType: params.linkType,
      linkedId: params.linkedId,
      createdById: params.createdById,
      note: params.note
    }
  });
}

async function ensureContextIssueRiskLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    issueId: string;
    riskId: string;
    createdById?: string;
  }
) {
  return prisma.contextIssueRiskLink.upsert({
    where: {
      issueId_riskId: {
        issueId: params.issueId,
        riskId: params.riskId
      }
    },
    update: {
      createdById: params.createdById
    },
    create: {
      tenantId: params.tenantId,
      issueId: params.issueId,
      riskId: params.riskId,
      createdById: params.createdById
    }
  });
}

export async function createDigitXDemoDataset(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    roleIds: Map<string, string>;
    passwordHash: string;
  }
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: params.tenantId } });

  if (tenant.slug === 'demo-tenant') {
    await resetDemoOperationalData(prisma, params.tenantId);
    await prisma.user.deleteMany({
      where: {
        tenantId: params.tenantId,
        email: { in: ['hr.manager@demo.local', 'ops.supervisor@demo.local'] }
      }
    });
  }

  const admin = await prisma.user.update({
    where: {
      tenantId_email: {
        tenantId: params.tenantId,
        email: 'admin@demo.local'
      }
    },
    data: {
      firstName: 'Farid',
      lastName: 'Aliyev',
      passwordHash: params.passwordHash,
      roleId: params.roleIds.get('Admin')
    }
  });

  const qualityManager = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'quality.manager@demo.local',
    firstName: 'Aysel',
    lastName: 'Mammadova',
    roleId: params.roleIds.get('Manager'),
    passwordHash: params.passwordHash
  });
  const operationsManager = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'ops.manager@demo.local',
    firstName: 'Kamran',
    lastName: 'Hasanov',
    roleId: params.roleIds.get('Manager'),
    passwordHash: params.passwordHash
  });
  const internalAuditor = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'internal.auditor@demo.local',
    firstName: 'Nigar',
    lastName: 'Karimova',
    roleId: params.roleIds.get('User'),
    passwordHash: params.passwordHash
  });
  const actionOwner = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'action.owner@demo.local',
    firstName: 'Orkhan',
    lastName: 'Safarov',
    roleId: params.roleIds.get('User'),
    passwordHash: params.passwordHash
  });
  const salesManager = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'sales.manager@demo.local',
    firstName: 'Sabina',
    lastName: 'Guliyeva',
    roleId: params.roleIds.get('Manager'),
    passwordHash: params.passwordHash
  });
  const procurementLead = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'procurement.lead@demo.local',
    firstName: 'Murad',
    lastName: 'Aliyev',
    roleId: params.roleIds.get('Manager'),
    passwordHash: params.passwordHash
  });
  const maintenanceLead = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'maintenance.lead@demo.local',
    firstName: 'Emil',
    lastName: 'Huseynov',
    roleId: params.roleIds.get('Manager'),
    passwordHash: params.passwordHash
  });
  const documentController = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'document.control@demo.local',
    firstName: 'Lala',
    lastName: 'Rahimova',
    roleId: params.roleIds.get('User'),
    passwordHash: params.passwordHash
  });

  await prisma.tenant.update({
    where: { id: params.tenantId },
    data: { name: 'Caspian Manufacturing LLC' }
  });

  await ensureTenantSetting(
    prisma,
    params.tenantId,
    'organization.companyName',
    'Caspian Manufacturing LLC',
    ['Demo Tenant', 'Integrated Management System', 'DigitX Manufacturing']
  );
  await ensureTenantSetting(prisma, params.tenantId, 'organization.industry', 'Manufacturing and industrial services');
  await ensureTenantSetting(prisma, params.tenantId, 'organization.location', 'Baku, Azerbaijan');
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId: params.tenantId, key: 'implementation.targetStandards' } },
    update: { value: JSON.stringify(['ISO 9001', 'ISO 14001', 'ISO 45001']) },
    create: { tenantId: params.tenantId, key: 'implementation.targetStandards', value: JSON.stringify(['ISO 9001', 'ISO 14001', 'ISO 45001']) }
  });
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId: params.tenantId, key: 'implementation.rolloutOwner' } },
    update: { value: 'Aysel Mammadova / QHSE Manager' },
    create: { tenantId: params.tenantId, key: 'implementation.rolloutOwner', value: 'Aysel Mammadova / QHSE Manager' }
  });
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId: params.tenantId, key: 'implementation.certificationGoal' } },
    update: { value: 'Prepare Caspian Manufacturing LLC for integrated ISO 9001, ISO 14001, and ISO 45001 certification readiness review.' },
    create: {
      tenantId: params.tenantId,
      key: 'implementation.certificationGoal',
      value: 'Prepare Caspian Manufacturing LLC for integrated ISO 9001, ISO 14001, and ISO 45001 certification readiness review.'
    }
  });
  await ensureTenantSetting(
    prisma,
    params.tenantId,
    'implementation.checklist',
    JSON.stringify([
      { id: 'scope-context', label: 'Define scope, context, and interested parties', done: true },
      { id: 'policy-documents', label: 'Approve policies and controlled document structure', done: true },
      { id: 'objectives-kpis', label: 'Set objectives, targets, and KPI review ownership', done: true },
      { id: 'process-risk', label: 'Map processes and assess key risks, hazards, and aspects', done: true },
      { id: 'operations-training', label: 'Deploy operational controls, training, and provider controls', done: false },
      { id: 'audit-review', label: 'Run internal audit and hold management review', done: false }
    ])
  );

  const customerParty = await ensureInterestedParty(prisma, {
    tenantId: params.tenantId,
    name: 'Azeri Energy Systems',
    type: InterestedPartyType.CUSTOMER,
    description: 'Key industrial customer requiring reliable delivery, traceability, and timely complaint response.',
    surveyEnabled: true,
    surveyTitle: 'Customer service and delivery feedback',
    surveyIntro: 'Please rate delivery reliability, communication, response speed, and overall confidence in Caspian Manufacturing LLC.',
    surveyScaleMax: 10,
    surveyCategoryLabels: ['Quality', 'Delivery', 'Communication', 'Response speed']
  });
  await ensureNeedExpectation(prisma, {
    tenantId: params.tenantId,
    interestedPartyId: customerParty.id,
    description: 'Receive on-time delivery, product traceability, and timely complaint closure updates.'
  });
  await ensureCustomerSurveyRequest(prisma, {
    tenantId: params.tenantId,
    interestedPartyId: customerParty.id,
    token: 'cml-q2-2026-azeri-energy-feedback',
    title: 'Q2 2026 customer feedback request',
    intro: 'Share your view on delivery, communication, complaint handling, and confidence in our service.',
    scaleMax: 10,
    categoryLabels: ['Quality', 'Delivery', 'Communication', 'Response speed'],
    recipientName: 'Rashad Ismayilov',
    recipientEmail: 'quality@azerienergy.example',
    respondentName: 'Rashad Ismayilov',
    respondentEmail: 'quality@azerienergy.example',
    respondentCompany: 'Azeri Energy Systems',
    respondentReference: 'AES-Q2-2026',
    ratings: {
      quality: 9,
      delivery: 8,
      communication: 9,
      'response-speed': 7
    },
    whatWorkedWell: 'The team responded quickly to technical questions and provided clear shipment updates.',
    improvementPriority: 'Faster formal closure updates on customer complaints.',
    comments: 'Overall service is reliable, but complaint closure timing should be more predictable.',
    averageScore: 8.25,
    status: 'COMPLETED',
    sentAt: toDate('2026-04-10'),
    completedAt: toDate('2026-04-14')
  });

  const internalIssue1 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.INTERNAL,
    title: 'Document changes are not always communicated consistently across shifts',
    description: 'Operators rely on supervisor briefings and printed copies, increasing the risk of using an outdated revision at the workstation.',
    category: 'Document control',
    status: ContextIssueStatus.OPEN
  });
  const internalIssue2 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.INTERNAL,
    title: 'Corrective actions are not always closed within target dates',
    description: 'Follow-up actions are tracked, but some owners escalate late and verification evidence is delayed.',
    category: 'Performance and follow-up',
    status: ContextIssueStatus.MONITORING
  });
  const externalIssue1 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.EXTERNAL,
    title: 'Imported component lead times remain unstable',
    description: 'Strategic suppliers have variable lead times, which affects production planning and on-time delivery commitments.',
    category: 'Supply chain',
    status: ContextIssueStatus.OPEN
  });
  const externalIssue2 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.EXTERNAL,
    title: 'Industrial customers expect stronger complaint response and traceability evidence',
    description: 'Customers increasingly request faster closure of complaints and quicker access to production and inspection records.',
    category: 'Customer requirements',
    status: ContextIssueStatus.OPEN
  });

  const salesProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-001',
    name: 'Sales and Contract Review',
    purpose: 'Confirm customer requirements, delivery commitments, and technical expectations before accepting work.',
    ownerUserId: salesManager.id,
    department: 'Commercial',
    scope: 'From enquiry and quotation through contract review and handover to operations.',
    inputsText: 'Customer specifications, forecasts, drawings, and commercial terms',
    outputsText: 'Approved quotations, reviewed contracts, handover information'
  });
  const procurementProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-002',
    name: 'Procurement',
    purpose: 'Select and control suppliers that can meet quality, delivery, environmental, and safety requirements.',
    ownerUserId: procurementLead.id,
    department: 'Supply Chain',
    scope: 'From supplier approval and purchasing through supplier review and incoming coordination.',
    inputsText: 'Approved supplier list, demand plan, specifications, evaluation data',
    outputsText: 'Purchase orders, supplier evaluations, supplier follow-up actions'
  });
  const productionProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-003',
    name: 'Production / Service Delivery',
    purpose: 'Deliver products and services in a controlled way that meets customer, quality, environmental, and OH&S requirements.',
    ownerUserId: operationsManager.id,
    department: 'Operations',
    scope: 'From job release and setup through production, inspection, and release.',
    inputsText: 'Released work orders, approved documents, calibrated equipment, trained people',
    outputsText: 'Finished product, service records, inspection evidence, released orders'
  });
  const maintenanceProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-004',
    name: 'Equipment Maintenance',
    purpose: 'Keep equipment and utilities available, safe, and capable of meeting planned output.',
    ownerUserId: maintenanceLead.id,
    department: 'Engineering',
    scope: 'From preventive maintenance planning through breakdown response and verification of return to service.',
    inputsText: 'Maintenance plans, breakdown reports, spare parts, equipment manuals',
    outputsText: 'Completed maintenance records, calibrated assets, restored equipment availability'
  });
  const qualityControlProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-005',
    name: 'Quality Control',
    purpose: 'Verify incoming, in-process, and final product conformity before release.',
    ownerUserId: qualityManager.id,
    department: 'Quality',
    scope: 'From inspection planning and sampling through disposition, release, and complaint feedback.',
    inputsText: 'Specifications, control plans, inspection methods, nonconformance data',
    outputsText: 'Inspection results, release decisions, complaint feedback, NCRs'
  });
  const hseProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-006',
    name: 'HSE Management',
    purpose: 'Control significant aspects, hazards, incidents, and compliance obligations across the site.',
    ownerUserId: qualityManager.id,
    department: 'QHSE',
    scope: 'From hazard/aspect review through incident follow-up, legal review, and operational control verification.',
    inputsText: 'Aspect register, hazard register, incident reports, legal requirements',
    outputsText: 'Control plans, actions, investigations, HSE review records'
  });
  const documentControlProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-PR-007',
    name: 'Document Control',
    purpose: 'Ensure current approved documents are available where needed and obsolete versions are withdrawn.',
    ownerUserId: documentController.id,
    department: 'IMS Coordination',
    scope: 'From drafting and review through approval, distribution, revision control, and archiving.',
    inputsText: 'Document requests, change needs, approval decisions',
    outputsText: 'Current approved documents, revision history, obsolete document archive'
  });

  const supplierRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Late supplier delivery',
    description: 'Single-source imported components may arrive late and interrupt the production schedule.',
    category: 'Supply Chain',
    likelihood: 4,
    severity: 4,
    existingControls: 'Approved supplier list, weekly expediting, and safety stock for critical parts.',
    plannedMitigationActions: 'Qualify an alternative supplier and formalize monthly supplier review meetings.',
    residualLikelihood: 3,
    residualImpact: 3,
    issueContextType: RiskIssueContextType.EXTERNAL,
    issueContext: externalIssue1.title,
    ownerId: procurementLead.id,
    targetDate: toDate('2026-05-20'),
    status: RiskStatus.IN_TREATMENT
  });
  const equipmentRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Equipment breakdown',
    description: 'Unplanned breakdown of a critical press or compressor could stop production and delay customer commitments.',
    category: 'Operations',
    likelihood: 3,
    severity: 5,
    existingControls: 'Preventive maintenance plan, spare parts for common failures, and shift checks.',
    plannedMitigationActions: 'Escalate overdue PMs and review critical spare availability.',
    residualLikelihood: 2,
    residualImpact: 4,
    ownerId: maintenanceLead.id,
    targetDate: toDate('2026-05-18'),
    status: RiskStatus.OPEN
  });
  const documentRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Incorrect document revision used',
    description: 'Printed or locally saved copies may not reflect the latest approved procedure or work instruction.',
    category: 'Document Control',
    likelihood: 3,
    severity: 4,
    existingControls: 'Controlled master register and approval workflow in the system.',
    plannedMitigationActions: 'Reinforce workstation document checks and withdraw uncontrolled hard copies.',
    residualLikelihood: 2,
    residualImpact: 3,
    issueContextType: RiskIssueContextType.INTERNAL,
    issueContext: internalIssue1.title,
    ownerId: documentController.id,
    targetDate: toDate('2026-05-12'),
    status: RiskStatus.OPEN
  });
  const complaintRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Customer complaint not closed on time',
    description: 'Delayed investigations and ownership gaps may extend complaint closure beyond customer expectations.',
    category: 'Customer',
    likelihood: 3,
    severity: 4,
    existingControls: 'Complaint log, weekly QHSE review, and escalation through management meetings.',
    plannedMitigationActions: 'Set formal response milestones and improve action owner follow-up.',
    residualLikelihood: 2,
    residualImpact: 3,
    issueContextType: RiskIssueContextType.EXTERNAL,
    issueContext: externalIssue2.title,
    ownerId: qualityManager.id,
    targetDate: toDate('2026-05-15'),
    status: RiskStatus.IN_TREATMENT
  });
  const spillRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Chemical spill / environmental release',
    description: 'Improper transfer or storage of chemicals could cause a localized spill and waste-management nonconformance.',
    category: 'Environment',
    likelihood: 2,
    severity: 5,
    existingControls: 'Bunds, spill kits, chemical handling instruction, and supervisor checks.',
    plannedMitigationActions: 'Refresh spill response training and strengthen pre-start transfer checks.',
    residualLikelihood: 1,
    residualImpact: 4,
    ownerId: operationsManager.id,
    targetDate: toDate('2026-05-25'),
    status: RiskStatus.OPEN
  });
  const workAtHeightRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Work at height hazard',
    description: 'Maintenance work on overhead ducting and access platforms can expose employees to fall risk if controls are not enforced.',
    category: 'OH&S',
    likelihood: 2,
    severity: 5,
    existingControls: 'Permit-to-work briefing, ladder inspection, and supervisor authorization.',
    plannedMitigationActions: 'Reconfirm harness inspection, task authorization, and contractor briefing controls.',
    residualLikelihood: 1,
    residualImpact: 4,
    ownerId: maintenanceLead.id,
    targetDate: toDate('2026-05-22'),
    status: RiskStatus.OPEN
  });

  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: externalIssue1.id, riskId: supplierRisk.id, createdById: admin.id });
  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: externalIssue2.id, riskId: complaintRisk.id, createdById: admin.id });
  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: internalIssue1.id, riskId: documentRisk.id, createdById: admin.id });
  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: internalIssue2.id, riskId: complaintRisk.id, createdById: admin.id });

  const qualityManual = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-QM-001',
    title: 'Quality Manual',
    type: 'Manual',
    summary: 'Defines the scope of the integrated management system, process interaction, and leadership commitments.',
    ownerId: qualityManager.id,
    effectiveDate: toDate('2026-01-08'),
    reviewDueDate: toDate('2027-01-08'),
    status: DocumentStatus.APPROVED
  });
  const documentControlProcedure = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-PRO-001',
    title: 'Document Control Procedure',
    type: 'Procedure',
    summary: 'Defines document drafting, review, approval, issue, revision control, and withdrawal of obsolete copies.',
    ownerId: documentController.id,
    effectiveDate: toDate('2026-01-12'),
    reviewDueDate: toDate('2027-01-12'),
    status: DocumentStatus.APPROVED
  });
  const internalAuditProcedure = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-PRO-002',
    title: 'Internal Audit Procedure',
    type: 'Procedure',
    summary: 'Defines audit planning, checklist preparation, audit execution, findings review, and follow-up.',
    ownerId: internalAuditor.id,
    effectiveDate: toDate('2026-01-14'),
    reviewDueDate: toDate('2027-01-14'),
    status: DocumentStatus.REVIEW,
    changeSummary: 'Under review to separate process audits from full-system audits.'
  });
  const ncrCapaProcedure = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-PRO-003',
    title: 'NCR and CAPA Procedure',
    type: 'Procedure',
    summary: 'Defines how nonconformities are recorded, investigated, corrected, verified, and closed.',
    ownerId: qualityManager.id,
    effectiveDate: toDate('2026-01-15'),
    reviewDueDate: toDate('2027-01-15'),
    status: DocumentStatus.APPROVED
  });
  const riskProcedure = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-PRO-004',
    title: 'Risk Management Procedure',
    type: 'Procedure',
    summary: 'Defines how business, environmental, and OH&S risks are assessed, treated, and reviewed.',
    ownerId: qualityManager.id,
    reviewDueDate: toDate('2026-06-30'),
    status: DocumentStatus.DRAFT,
    changeSummary: 'Draft update to align one method across quality, environmental, and OH&S risks.'
  });
  const incidentProcedure = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-PRO-005',
    title: 'HSE Incident Reporting Procedure',
    type: 'Procedure',
    summary: 'Defines incident and near-miss reporting, investigation, corrective action, and communication.',
    ownerId: qualityManager.id,
    effectiveDate: toDate('2026-01-20'),
    reviewDueDate: toDate('2027-01-20'),
    status: DocumentStatus.REVIEW,
    changeSummary: 'Review includes closer alignment with hazard and action tracking.'
  });
  const supplierProcedure = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-PRO-006',
    title: 'Supplier Evaluation Procedure',
    type: 'Procedure',
    summary: 'Defines supplier approval, monitoring, evaluation scoring, escalation, and re-evaluation.',
    ownerId: procurementLead.id,
    effectiveDate: toDate('2026-01-18'),
    reviewDueDate: toDate('2027-01-18'),
    status: DocumentStatus.APPROVED
  });
  const obsoleteInstruction = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'CML-WI-007',
    title: 'Legacy Incoming Inspection Work Instruction',
    type: 'Work Instruction',
    summary: 'Older inspection instruction retained for historical reference after replacement by the current quality control pack.',
    ownerId: qualityManager.id,
    effectiveDate: toDate('2025-06-01'),
    reviewDueDate: toDate('2026-01-31'),
    status: DocumentStatus.OBSOLETE,
    changeSummary: 'Withdrawn after the new inspection control package was issued.'
  });

  const audit = await ensureAudit(prisma, {
    tenantId: params.tenantId,
    code: 'CML-IA-2026-01',
    title: 'Internal Audit - Procurement and Production Controls',
    type: 'INTERNAL_AUDIT',
    standard: 'ISO 9001',
    programme: '2026 integrated internal audit programme',
    scopeType: 'Process',
    scope: 'Procurement approval, supplier follow-up, production records, and complaint response controls.',
    objectives: 'Verify supplier control, document use, and response to customer issues across procurement and operations.',
    criteria: 'ISO 9001 clauses 7, 8, 9, 10 plus internal procedures for supplier evaluation, document control, and NCR/CAPA.',
    agenda: 'Opening meeting, process walk-through, sample records, interviews, findings review, close-out.',
    openingMeetingNotes: 'Audit scope confirmed with Procurement and Operations managers. Focus placed on supplier review and complaint response evidence.',
    closingMeetingNotes: 'Team agreed immediate follow-up on supplier review evidence and customer complaint closure milestones.',
    leadAuditorId: internalAuditor.id,
    auditeeArea: 'Procurement and Production',
    scheduledAt: toDate('2026-04-08'),
    startedAt: toDate('2026-04-08'),
    completedAt: undefined,
    summary: 'The audit confirmed the processes are generally controlled, with gaps in supplier evaluation cadence and customer complaint closure follow-up.',
    conclusion: 'The management system is functioning, but stronger evidence discipline and corrective follow-up are needed in two sampled areas.',
    recommendations: 'Formalize supplier review evidence, reinforce complaint escalation timing, and verify owners close actions on time.',
    status: AuditStatus.CHECKLIST_COMPLETED
  });

  const auditQuestions = await getAuditChecklistQuestionDelegate(prisma).findMany({
    where: {
      tenantId: params.tenantId,
      standard: 'ISO 9001',
      clause: { in: ['4', '5', '6', '7', '8', '9', '10'] },
      isActive: true
    },
    orderBy: [{ clause: 'asc' }, { sortOrder: 'asc' }]
  });

  const firstQuestionByClause = new Map<string, (typeof auditQuestions)[number]>();
  for (const question of auditQuestions) {
    if (!firstQuestionByClause.has(question.clause)) {
      firstQuestionByClause.set(question.clause, question);
    }
  }

  const checklistPlan = [
    { clause: '4', response: AuditChecklistResponse.YES, notes: 'Context issues, obligations, and customer needs are listed and reviewed.' },
    { clause: '5', response: AuditChecklistResponse.YES, notes: 'Process owners are assigned and attended the audit opening.' },
    { clause: '6', response: AuditChecklistResponse.YES, notes: 'Key risks are identified and linked to owners and target dates.' },
    { clause: '7', response: AuditChecklistResponse.NO, notes: 'Supplier review evidence and current approved procedure use were inconsistent in sampled records.' },
    { clause: '8', response: AuditChecklistResponse.NO, notes: 'One customer complaint remained open beyond the internal response target without escalation evidence.' },
    { clause: '9', response: AuditChecklistResponse.YES, notes: 'KPIs and prior audit outputs were available for review.' },
    { clause: '10', response: AuditChecklistResponse.PARTIAL, notes: 'Corrective actions exist, but some owners escalate late and verification evidence is delayed.' }
  ] as const;

  const checklistItems = new Map<string, Awaited<ReturnType<typeof ensureChecklistItem>>>();
  for (const [index, item] of checklistPlan.entries()) {
    const question = firstQuestionByClause.get(item.clause);
    if (!question) {
      continue;
    }
    const checklistItem = await ensureChecklistItem(prisma, {
      tenantId: params.tenantId,
      auditId: audit.id,
      sourceQuestionId: question.id,
      clause: question.clause,
      subclause: question.subclause,
      standard: 'ISO 9001',
      title: question.title,
      sortOrder: index + 1,
      response: item.response,
      notes: item.notes
    });
    checklistItems.set(item.clause, checklistItem);
  }

  const supplierFinding = await ensureAuditFinding(prisma, {
    tenantId: params.tenantId,
    auditId: audit.id,
    checklistItemId: checklistItems.get('7')?.id,
    clause: '7',
    title: 'Supplier review evidence was not current for one critical supplier',
    description: 'The monthly evaluation evidence for one high-risk supplier was overdue, and follow-up actions were discussed verbally without controlled records.',
    severity: AuditFindingSeverity.MAJOR,
    ownerId: procurementLead.id,
    dueDate: toDate('2026-04-22'),
    status: AuditFindingStatus.CAPA_CREATED
  });
  const complaintFinding = await ensureAuditFinding(prisma, {
    tenantId: params.tenantId,
    auditId: audit.id,
    checklistItemId: checklistItems.get('8')?.id,
    clause: '8',
    title: 'Customer complaint closure escalation was not documented on time',
    description: 'One complaint remained open beyond the target date, and the escalation path was not visible in the record.',
    severity: AuditFindingSeverity.OBSERVATION,
    ownerId: actionOwner.id,
    dueDate: toDate('2026-04-18'),
    status: AuditFindingStatus.OPEN
  });

  const complaintNcr = await ensureNcr(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-NCR-001',
    title: 'Customer complaint response exceeded target closure time',
    category: NcrCategory.COMPLAINT,
    source: NcrSource.CUSTOMER,
    description: 'A customer complaint on incorrect labeling remained open beyond the internal target because ownership changed during investigation.',
    reportedByUserId: salesManager.id,
    ownerUserId: qualityManager.id,
    department: 'Quality',
    location: 'Customer complaint desk',
    dateReported: toDate('2026-04-02'),
    dueDate: toDate('2026-04-16'),
    severity: NcrSeverity.HIGH,
    priority: NcrPriority.HIGH,
    containmentAction: 'Customer was informed of interim containment and stock segregation was completed within the same day.',
    investigationSummary: 'The complaint was transferred between functions without a formal owner handover or escalation trigger.',
    rootCause: 'Complaint workflow milestones were not clear when the issue required cross-functional investigation.',
    correctiveActionSummary: 'Assign one complaint owner, define escalation timing, and review complaint status twice weekly.',
    status: NcrStatus.PENDING_VERIFICATION
  });
  const processNcr = await ensureNcr(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-NCR-002',
    title: 'Supplier evaluation records were overdue for a critical supplier',
    category: NcrCategory.PROCESS,
    source: NcrSource.AUDIT,
    description: `Raised from audit ${audit.code}. Supplier performance review records were not updated in line with the planned monthly cadence.`,
    reportedByUserId: internalAuditor.id,
    ownerUserId: procurementLead.id,
    department: 'Supply Chain',
    location: 'Procurement',
    dateReported: toDate('2026-04-08'),
    dueDate: toDate('2026-04-22'),
    severity: NcrSeverity.MEDIUM,
    priority: NcrPriority.HIGH,
    containmentAction: 'Procurement completed an immediate supplier review and confirmed no open delivery recovery actions were missed.',
    investigationSummary: 'Supplier evaluation reminders depended on manual follow-up and were not reviewed in a fixed monthly meeting.',
    rootCause: 'The supplier review calendar and evidence retention were not fully standardized.',
    correctiveActionSummary: 'Introduce a fixed supplier review calendar and retain review outputs in the controlled register.',
    status: NcrStatus.ACTION_IN_PROGRESS
  });

  const supplierCapa = await ensureCapa(prisma, {
    tenantId: params.tenantId,
    title: 'Formalize monthly supplier evaluation and escalation control',
    source: `Internal audit ${audit.code}`,
    category: 'Supplier Control',
    problemStatement: 'Evidence of supplier review and escalation was not current for one critical supplier.',
    containmentAction: 'Immediate supplier review was completed and open supply issues were checked before the next production release.',
    rootCause: 'The process relied on reminders and personal follow-up instead of a controlled monthly review rhythm and retained meeting output.',
    correction: 'Update the latest supplier evaluation and confirm current delivery and quality status.',
    correctiveAction: 'Create a monthly supplier review calendar, assign a named owner, and store meeting outputs and resulting actions in the register.',
    preventiveAction: 'Add supplier review cadence to management KPI review and internal audit sampling.',
    verificationMethod: 'Verify three consecutive monthly supplier reviews are completed and retained with actions closed on time.',
    ownerId: procurementLead.id,
    dueDate: toDate('2026-05-16'),
    status: CapaStatus.IN_PROGRESS
  });

  const findingAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'audit',
    sourceId: audit.id,
    title: 'Clarify complaint escalation owner and response milestones',
    description: 'Define who owns overdue complaint escalation, record the escalation decision, and verify the next two complaints close to target.',
    ownerId: actionOwner.id,
    dueDate: toDate('2026-04-18'),
    status: ActionItemStatus.IN_PROGRESS
  });
  const complaintAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'ncr',
    sourceId: complaintNcr.id,
    title: 'Review overdue complaint records and confirm current owners',
    description: 'Check all open complaints, confirm owners, and escalate any record past target closure time.',
    ownerId: qualityManager.id,
    dueDate: toDate('2026-04-12'),
    status: ActionItemStatus.OPEN
  });
  const supplierAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'ncr',
    sourceId: processNcr.id,
    title: 'Restore monthly supplier review meeting and evidence log',
    description: 'Re-establish a fixed review meeting and store minutes, actions, and supplier scores in one controlled record.',
    ownerId: procurementLead.id,
    dueDate: toDate('2026-04-22'),
    status: ActionItemStatus.IN_PROGRESS
  });
  const riskAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'risk',
    sourceId: supplierRisk.id,
    title: 'Qualify a backup supplier for imported components',
    description: 'Assess and approve a secondary supplier to reduce exposure from late imported component delivery.',
    ownerId: procurementLead.id,
    dueDate: toDate('2026-05-20'),
    status: ActionItemStatus.OPEN
  });
  const maintenanceAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'risk',
    sourceId: equipmentRisk.id,
    title: 'Verify permit-to-work and harness checks for maintenance at height',
    description: 'Review current work-at-height controls for scheduled maintenance and confirm permits, equipment inspection, and supervisor sign-off are in place.',
    ownerId: maintenanceLead.id,
    dueDate: toDate('2026-04-24'),
    status: ActionItemStatus.IN_PROGRESS
  });

  await prisma.auditFinding.update({
    where: { id: supplierFinding.id },
    data: {
      linkedCapaId: supplierCapa.id,
      linkedActionItemId: null,
      status: AuditFindingStatus.CAPA_CREATED
    }
  });
  await prisma.auditFinding.update({
    where: { id: complaintFinding.id },
    data: {
      linkedActionItemId: findingAction.id,
      linkedCapaId: null,
      status: AuditFindingStatus.OPEN
    }
  });

  const complaintsKpi = await ensureKpi(prisma, {
    tenantId: params.tenantId,
    name: 'Customer complaints',
    description: 'Tracks the number of open customer complaints in the current reporting month.',
    ownerId: qualityManager.id,
    target: 2,
    warningThreshold: 3,
    actual: 3,
    unit: 'cases',
    periodLabel: 'Apr 2026',
    direction: KpiDirection.AT_MOST
  });
  const deliveryKpi = await ensureKpi(prisma, {
    tenantId: params.tenantId,
    name: 'On-time delivery',
    description: 'Percentage of orders delivered within the agreed customer commitment date.',
    ownerId: operationsManager.id,
    target: 95,
    warningThreshold: 92,
    actual: 92,
    unit: '%',
    periodLabel: 'Apr 2026',
    direction: KpiDirection.AT_LEAST
  });
  const auditClosureKpi = await ensureKpi(prisma, {
    tenantId: params.tenantId,
    name: 'Audit finding closure rate',
    description: 'Percentage of audit findings closed within agreed due dates.',
    ownerId: qualityManager.id,
    target: 90,
    warningThreshold: 85,
    actual: 78,
    unit: '%',
    periodLabel: 'Apr 2026',
    direction: KpiDirection.AT_LEAST
  });
  const trainingKpi = await ensureKpi(prisma, {
    tenantId: params.tenantId,
    name: 'Training completion rate',
    description: 'Percentage of assigned training completed within target due dates.',
    ownerId: qualityManager.id,
    target: 95,
    warningThreshold: 90,
    actual: 88,
    unit: '%',
    periodLabel: 'Apr 2026',
    direction: KpiDirection.AT_LEAST
  });
  const incidentKpi = await ensureKpi(prisma, {
    tenantId: params.tenantId,
    name: 'Incident rate',
    description: 'Monthly count of reported incidents and near misses requiring formal review.',
    ownerId: qualityManager.id,
    target: 1,
    warningThreshold: 2,
    actual: 2,
    unit: 'events',
    periodLabel: 'Apr 2026',
    direction: KpiDirection.AT_MOST
  });
  const supplierPerformanceKpi = await ensureKpi(prisma, {
    tenantId: params.tenantId,
    name: 'Supplier performance',
    description: 'Combined supplier quality and delivery performance score for critical suppliers.',
    ownerId: procurementLead.id,
    target: 85,
    warningThreshold: 80,
    actual: 81,
    unit: 'score',
    periodLabel: 'Apr 2026',
    direction: KpiDirection.AT_LEAST
  });

  await ensureKpiReading(prisma, { tenantId: params.tenantId, kpiId: complaintsKpi.id, value: 3, readingDate: toDate('2026-04-25'), notes: 'One complaint pending final verification.' });
  await ensureKpiReading(prisma, { tenantId: params.tenantId, kpiId: deliveryKpi.id, value: 92, readingDate: toDate('2026-04-25'), notes: 'Supplier delays affected two urgent orders.' });
  await ensureKpiReading(prisma, { tenantId: params.tenantId, kpiId: auditClosureKpi.id, value: 78, readingDate: toDate('2026-04-25'), notes: 'Two findings remain open beyond the planned date.' });
  await ensureKpiReading(prisma, { tenantId: params.tenantId, kpiId: trainingKpi.id, value: 88, readingDate: toDate('2026-04-25'), notes: 'Internal auditor refresher is still open for one participant.' });
  await ensureKpiReading(prisma, { tenantId: params.tenantId, kpiId: incidentKpi.id, value: 2, readingDate: toDate('2026-04-25'), notes: 'One spill and one near miss were reported this month.' });
  await ensureKpiReading(prisma, { tenantId: params.tenantId, kpiId: supplierPerformanceKpi.id, value: 81, readingDate: toDate('2026-04-25'), notes: 'Critical supplier remains approved with conditions.' });

  const isoAwareness = await ensureTraining(prisma, {
    tenantId: params.tenantId,
    title: 'ISO awareness',
    audience: 'All employees',
    description: 'Overview of the integrated management system, employee responsibilities, and escalation routes.',
    ownerId: qualityManager.id,
    deliveryMethod: 'Classroom',
    dueDate: toDate('2026-04-30'),
    completion: 96
  });
  const docControlTraining = await ensureTraining(prisma, {
    tenantId: params.tenantId,
    title: 'Document control training',
    audience: 'Process owners and supervisors',
    description: 'How to access current approved documents, request revisions, and withdraw obsolete copies.',
    ownerId: documentController.id,
    deliveryMethod: 'Workshop',
    dueDate: toDate('2026-04-28'),
    completion: 90
  });
  const auditorTraining = await ensureTraining(prisma, {
    tenantId: params.tenantId,
    title: 'Internal auditor training',
    audience: 'Selected internal auditors',
    description: 'Refresher on audit planning, evidence sampling, findings grading, and follow-up routes.',
    ownerId: qualityManager.id,
    deliveryMethod: 'Classroom',
    dueDate: toDate('2026-05-10'),
    completion: 75
  });
  const hseInduction = await ensureTraining(prisma, {
    tenantId: params.tenantId,
    title: 'HSE induction',
    audience: 'Employees and contractors',
    description: 'Covers incident reporting, hazard awareness, PPE rules, and environmental controls.',
    ownerId: qualityManager.id,
    deliveryMethod: 'Induction briefing',
    dueDate: toDate('2026-04-26'),
    completion: 92
  });

  await ensureTrainingAssignment(prisma, {
    tenantId: params.tenantId,
    trainingId: isoAwareness.id,
    userId: actionOwner.id,
    dueDate: toDate('2026-04-30'),
    completedAt: toDate('2026-04-18'),
    status: TrainingAssignmentStatus.COMPLETED,
    evidenceSummary: 'Attendance signed and awareness quiz passed.'
  });
  await ensureTrainingAssignment(prisma, {
    tenantId: params.tenantId,
    trainingId: docControlTraining.id,
    userId: operationsManager.id,
    dueDate: toDate('2026-04-28'),
    completedAt: toDate('2026-04-20'),
    status: TrainingAssignmentStatus.COMPLETED,
    evidenceSummary: 'Workshop attended and document retrieval exercise completed.'
  });
  await ensureTrainingAssignment(prisma, {
    tenantId: params.tenantId,
    trainingId: auditorTraining.id,
    userId: internalAuditor.id,
    dueDate: toDate('2026-05-10'),
    status: TrainingAssignmentStatus.IN_PROGRESS,
    notes: 'Final case-study review still open.'
  });
  await ensureTrainingAssignment(prisma, {
    tenantId: params.tenantId,
    trainingId: hseInduction.id,
    userId: actionOwner.id,
    dueDate: toDate('2026-04-26'),
    completedAt: toDate('2026-04-16'),
    status: TrainingAssignmentStatus.COMPLETED,
    evidenceSummary: 'Induction briefing completed with supervisor sign-off.'
  });

  const legalObligation = await ensureComplianceObligation(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-CO-001',
    title: 'Waste and chemical handling records are retained and reviewed',
    sourceName: 'Environmental permit conditions',
    obligationType: 'Regulatory',
    jurisdiction: 'Azerbaijan',
    description: 'Chemical storage, transfer, spill response, and waste disposal records must be controlled and retained.',
    ownerUserId: qualityManager.id,
    reviewFrequencyMonths: 12,
    nextReviewDate: toDate('2026-12-10'),
    status: ComplianceObligationStatus.ACTIVE
  });
  const customerObligation = await ensureComplianceObligation(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-CO-002',
    title: 'Customer traceability and complaint response requirements are maintained',
    sourceName: 'Customer quality agreement',
    obligationType: 'Customer',
    jurisdiction: 'Key account requirements',
    description: 'Traceability retrieval and complaint response expectations from key customers must be reflected in operations and quality controls.',
    ownerUserId: qualityManager.id,
    reviewFrequencyMonths: 6,
    nextReviewDate: toDate('2026-09-15'),
    status: ComplianceObligationStatus.UNDER_REVIEW
  });

  const incident = await ensureIncident(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-INC-001',
    title: 'Chemical transfer spill at treatment area',
    type: 'INCIDENT',
    category: 'ENVIRONMENT',
    description: 'A small chemical spill occurred during transfer to the treatment area before morning startup.',
    eventDate: toDate('2026-03-29'),
    location: 'Treatment area',
    ownerUserId: operationsManager.id,
    severity: 'MEDIUM',
    immediateAction: 'Area isolated, absorbent materials used, and residue disposed through the approved route.',
    investigationSummary: 'Transfer-point checks were incomplete and hose integrity was not visually verified before startup.',
    rootCause: 'The pre-start transfer check was not included in the local startup routine.',
    rcaMethod: 'FIVE_WHY',
    correctiveActionSummary: 'Add a transfer-point check to the startup list and re-brief operators.',
    status: 'ACTION_IN_PROGRESS'
  });
  const nearMiss = await ensureIncident(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-NM-001',
    title: 'Forklift and pedestrian near miss at dispatch',
    type: 'NEAR_MISS',
    category: 'SAFETY',
    description: 'A pedestrian entered the dispatch lane while a forklift was reversing into the loading route. No contact occurred.',
    eventDate: toDate('2026-04-01'),
    location: 'Dispatch lane',
    ownerUserId: qualityManager.id,
    severity: 'HIGH',
    immediateAction: 'Dispatch was paused and the temporary route was re-marked.',
    investigationSummary: 'Temporary route changes were not consistently communicated between shifts.',
    rootCause: 'Temporary traffic-control changes were not standardized in the dispatch handover.',
    rcaMethod: 'FISHBONE',
    correctiveActionSummary: 'Clarify route segregation and assign spotter responsibility during peak dispatch.',
    status: 'INVESTIGATION'
  });
  const incidentAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'incident',
    sourceId: incident.id,
    title: 'Verify spill-response readiness at treatment area',
    description: 'Check spill kit contents, add startup transfer checks, and confirm operator awareness.',
    ownerId: operationsManager.id,
    dueDate: toDate('2026-04-27'),
    status: ActionItemStatus.OPEN
  });

  const aspect = await ensureEnvironmentalAspect(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-EA-001',
    activity: 'Chemical transfer and storage',
    aspect: 'Chemical handling and potential spill',
    impact: 'Potential localized spill, waste generation, and contamination of adjacent work areas.',
    lifecycleStage: EnvironmentalAspectStage.NORMAL_OPERATION,
    controlSummary: 'Bunds, spill kits, handling instruction, and supervisor startup checks.',
    significance: EnvironmentalAspectSignificance.HIGH,
    ownerUserId: operationsManager.id,
    reviewDate: toDate('2026-09-30'),
    status: EnvironmentalAspectStatus.ACTIVE
  });
  const hazard = await ensureHazardIdentification(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-HZ-001',
    activity: 'Maintenance work on elevated access platform',
    hazard: 'Work at height during ducting and utility maintenance',
    potentialHarm: 'Potential fall from height leading to serious injury.',
    exposureStage: 'NON_ROUTINE',
    existingControls: 'Permit-to-work, ladder inspection, harness checks, and supervisor authorization.',
    severity: 'HIGH',
    ownerUserId: maintenanceLead.id,
    reviewDate: toDate('2026-08-15'),
    status: 'ACTIVE'
  });
  const provider = await ensureExternalProvider(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-SP-001',
    providerName: 'Caspian Components Supply',
    providerType: 'SUPPLIER',
    suppliedScope: 'Imported control components and specialized assemblies for production.',
    approvalBasis: 'Approved supplier based on historical quality performance and capability review, with conditions on delivery follow-up.',
    criticality: 'HIGH',
    ownerUserId: procurementLead.id,
    evaluationDate: toDate('2026-03-20'),
    qualityScore: 4,
    deliveryScore: 3,
    responsivenessScore: 3,
    complianceScore: 4,
    traceabilityScore: 4,
    changeControlScore: 3,
    evaluationScore: 78,
    evaluationOutcome: 'APPROVED_WITH_CONDITIONS',
    evaluationSummary: 'Supplier remains approved, but delivery reliability and formal review evidence need closer monitoring.',
    nextReviewDate: toDate('2026-07-31'),
    status: 'UNDER_REVIEW'
  });
  const changeRequest = await ensureChangeRequest(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'CML-MOC-001',
    title: 'Introduce barcode-based batch label verification',
    changeType: 'PROCESS',
    reason: 'Several complaints and audit checks highlighted the need for faster traceability and stronger revision control at release.',
    affectedArea: 'Production, quality control, shipping',
    proposedChange: 'Introduce barcode verification at final labeling and release to reduce manual error and improve traceability retrieval.',
    impactSummary: 'The change affects label printing, final inspection, and complaint response time.',
    controlSummary: 'Pilot on one product family, validate output, retrain users, and update the related documents before full release.',
    ownerUserId: qualityManager.id,
    targetImplementationDate: toDate('2026-07-10'),
    reviewDate: toDate('2026-05-20'),
    status: 'REVIEWING'
  });

  const managementReview = await ensureManagementReview(prisma, {
    tenantId: params.tenantId,
    title: 'Management Review - Q2 2026',
    reviewDate: toDate('2026-04-22'),
    chairpersonId: admin.id,
    agenda: 'Review KPI performance, audit results, complaints, supplier performance, risks, incidents, changes, and resource needs.',
    auditResults: 'One internal audit completed. Two findings raised: one moved into CAPA and one managed through a targeted audit action.',
    capaStatus: 'One major supplier-control CAPA is in progress. One complaint NCR is pending verification.',
    kpiPerformance: 'On-time delivery, complaint closure, and audit closure rate need improvement. Supplier performance remains below target.',
    customerInterestedPartiesFeedback: 'Customer complaints remain low in volume but slower than target to close. Traceability response speed is a recurring expectation.',
    providerPerformance: 'Critical supplier remains approved with conditions pending better review evidence and delivery follow-up.',
    complianceObligations: 'Environmental permit controls and customer quality agreement requirements are current and under review.',
    incidentEmergencyPerformance: 'One spill incident and one near miss were investigated with open follow-up actions on controls and awareness.',
    consultationCommunication: 'Supervisors and owners were briefed on audit outcomes, complaint escalation, and HSE incident follow-up.',
    risksOpportunities: 'Supplier continuity, complaint closure timing, document control, and work-at-height risks remain active priorities.',
    changesAffectingSystem: 'Barcode-based batch label verification is under review as a system improvement.',
    previousActions: 'Most prior actions are progressing, but some due dates need closer escalation.',
    minutes: 'Leadership agreed to tighten follow-up discipline, improve supplier review evidence, and accelerate complaint closure verification.',
    decisions: 'Approve stronger supplier review cadence, complaint escalation controls, and the barcode traceability pilot.',
    improvementActions: 'Track overdue actions weekly and verify close-out evidence before the next review.',
    systemChangesNeeded: 'Update the internal audit, incident, and document control procedures as part of the next review cycle.',
    objectiveTargetChanges: 'Keep current targets but raise focus on complaint closure and supplier review compliance.',
    resourceNeeds: 'Allocate one process owner to lead document cleanup and barcode pilot coordination.',
    effectivenessConclusion: 'The management system is functioning, but follow-up control and evidence discipline need strengthening.',
    summary: 'Q2 review confirmed a stable IMS foundation with priority actions in supplier control, complaints, and document discipline.',
    status: ManagementReviewStatus.HELD
  });

  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: salesProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: complaintRisk.id, createdById: admin.id, note: 'Complaint response and contract review influence customer confidence.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: supplierProcedure.id, createdById: admin.id, note: 'Primary supplier control procedure.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: supplierRisk.id, createdById: admin.id, note: 'Main supply continuity exposure.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.AUDIT, linkedId: audit.id, createdById: admin.id, note: 'Internal audit covered supplier review controls.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.NCR, linkedId: processNcr.id, createdById: admin.id, note: 'NCR raised for overdue supplier review evidence.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.ACTION, linkedId: supplierAction.id, createdById: admin.id, note: 'Corrective follow-up for supplier review cadence.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.KPI, linkedId: supplierPerformanceKpi.id, createdById: admin.id, note: 'Supplier performance KPI monitored by procurement.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: productionProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: qualityManual.id, createdById: admin.id, note: 'System manual supports process interaction and release discipline.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: productionProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: equipmentRisk.id, createdById: admin.id, note: 'Equipment breakdown affects service continuity.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: maintenanceProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: riskProcedure.id, createdById: admin.id, note: 'Risk-based planning supports preventive maintenance priorities.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: maintenanceProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: equipmentRisk.id, createdById: admin.id, note: 'Critical maintenance exposure is tracked as equipment breakdown risk.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: maintenanceProcess.id, linkType: ProcessRegisterLinkType.ACTION, linkedId: maintenanceAction.id, createdById: admin.id, note: 'Current follow-up action reinforces work-at-height controls for maintenance activity.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: qualityControlProcess.id, linkType: ProcessRegisterLinkType.NCR, linkedId: complaintNcr.id, createdById: admin.id, note: 'Customer complaint NCR is managed through quality control and complaint handling.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: qualityControlProcess.id, linkType: ProcessRegisterLinkType.KPI, linkedId: complaintsKpi.id, createdById: admin.id, note: 'Customer complaints KPI reviewed by quality.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: hseProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: spillRisk.id, createdById: admin.id, note: 'Environmental spill risk sits in HSE controls.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: hseProcess.id, linkType: ProcessRegisterLinkType.ACTION, linkedId: incidentAction.id, createdById: admin.id, note: 'Incident follow-up strengthens HSE controls.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: documentControlProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: documentControlProcedure.id, createdById: admin.id, note: 'Primary controlled-document procedure.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: documentControlProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: documentRisk.id, createdById: admin.id, note: 'Revision-control risk tracked through document control.' });

  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: legalObligation.id,
    linkType: ComplianceObligationLinkType.PROCESS,
    linkedId: hseProcess.id,
    createdById: admin.id,
    note: 'HSE management owns chemical handling and waste-control review.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: customerObligation.id,
    linkType: ComplianceObligationLinkType.PROCESS,
    linkedId: qualityControlProcess.id,
    createdById: admin.id,
    note: 'Quality control and complaints workflow reflect customer traceability expectations.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: customerObligation.id,
    linkType: ComplianceObligationLinkType.AUDIT,
    linkedId: audit.id,
    createdById: admin.id,
    note: 'The internal audit sampled complaint and supplier controls against customer expectations.'
  });

  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: incident.id,
    linkType: 'PROCESS',
    linkedId: hseProcess.id,
    createdById: admin.id,
    note: 'HSE management owns spill follow-up and control verification.'
  });
  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: incident.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'Linked action tracks spill-response improvement.'
  });
  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: nearMiss.id,
    linkType: 'RISK',
    linkedId: workAtHeightRisk.id,
    createdById: admin.id,
    note: 'Near misses reinforce the need for stronger risk-control discipline.'
  });

  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect.id,
    linkType: 'PROCESS',
    linkedId: hseProcess.id,
    createdById: admin.id,
    note: 'HSE management owns the aspect review and controls.'
  });
  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'Spill-response action also strengthens the aspect control.'
  });

  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard.id,
    linkType: 'PROCESS',
    linkedId: maintenanceProcess.id,
    createdById: admin.id,
    note: 'Maintenance owns work-at-height planning and controls.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard.id,
    linkType: 'RISK',
    linkedId: workAtHeightRisk.id,
    createdById: admin.id,
    note: 'The hazard is tracked as a live OH&S risk.'
  });

  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider.id,
    linkType: 'PROCESS',
    linkedId: procurementProcess.id,
    createdById: admin.id,
    note: 'Procurement owns supplier approval and performance review.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider.id,
    linkType: 'RISK',
    linkedId: supplierRisk.id,
    createdById: admin.id,
    note: 'Supplier delivery risk is linked directly to this provider.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider.id,
    linkType: 'AUDIT',
    linkedId: audit.id,
    createdById: admin.id,
    note: 'The internal audit reviewed supplier evaluation evidence relevant to this provider.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider.id,
    linkType: 'ACTION',
    linkedId: riskAction.id,
    createdById: admin.id,
    note: 'Backup supplier qualification is the current risk-reduction action.'
  });

  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest.id,
    linkType: 'PROCESS',
    linkedId: qualityControlProcess.id,
    createdById: admin.id,
    note: 'Quality control will pilot the barcode traceability verification.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest.id,
    linkType: 'DOCUMENT',
    linkedId: documentControlProcedure.id,
    createdById: admin.id,
    note: 'Document control will update the related controlled records before rollout.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest.id,
    linkType: 'ACTION',
    linkedId: findingAction.id,
    createdById: admin.id,
    note: 'Complaint follow-up discipline and traceability improvements are connected.'
  });

  void managementReview;
  void obsoleteInstruction;
}
