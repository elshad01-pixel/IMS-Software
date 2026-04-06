import {
  ActionItemStatus,
  AuditChecklistResponse,
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditStatus,
  ComplianceObligationLinkType,
  ComplianceObligationStatus,
  ContextIssueStatus,
  ContextIssueType,
  DocumentStatus,
  EnvironmentalAspectSignificance,
  EnvironmentalAspectStage,
  EnvironmentalAspectStatus,
  EmergencyPreparednessStatus,
  EmergencyPreparednessType,
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
  RiskStatus
} from '@prisma/client';
import {
  getAuditChecklistQuestionDelegate,
  getChangeRequestDelegate,
  getChangeRequestLinkDelegate,
  getEnvironmentalAspectDelegate,
  getEnvironmentalAspectLinkDelegate,
  getEmergencyPreparednessDelegate,
  getEmergencyPreparednessLinkDelegate,
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
  }
) {
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
      status: DocumentStatus.APPROVED,
      effectiveDate: params.effectiveDate,
      reviewDueDate: params.reviewDueDate,
      approvedAt: params.effectiveDate ?? new Date(),
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
      status: DocumentStatus.APPROVED,
      effectiveDate: params.effectiveDate,
      reviewDueDate: params.reviewDueDate,
      approvedAt: params.effectiveDate ?? new Date()
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
    scope: string;
    leadAuditorId?: string;
    auditeeArea: string;
    scheduledAt: Date;
    startedAt: Date;
    completedAt: Date;
    summary: string;
    conclusion: string;
    recommendations: string;
  }
) {
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
      scope: params.scope,
      leadAuditorId: params.leadAuditorId,
      auditeeArea: params.auditeeArea,
      scheduledAt: params.scheduledAt,
      startedAt: params.startedAt,
      checklistCompletedAt: params.completedAt,
      completedAt: params.completedAt,
      completedByAuditorId: params.leadAuditorId,
      summary: params.summary,
      conclusion: params.conclusion,
      recommendations: params.recommendations,
      status: AuditStatus.COMPLETED,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      code: params.code,
      title: params.title,
      type: params.type,
      standard: params.standard,
      scope: params.scope,
      leadAuditorId: params.leadAuditorId,
      auditeeArea: params.auditeeArea,
      scheduledAt: params.scheduledAt,
      startedAt: params.startedAt,
      checklistCompletedAt: params.completedAt,
      completedAt: params.completedAt,
      completedByAuditorId: params.leadAuditorId,
      summary: params.summary,
      conclusion: params.conclusion,
      recommendations: params.recommendations,
      status: AuditStatus.COMPLETED
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
    description: string;
    reportedByUserId?: string;
    ownerUserId?: string;
    department?: string;
    location?: string;
    dueDate?: Date;
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
      category: NcrCategory.PROCESS,
      source: NcrSource.AUDIT,
      description: params.description,
      severity: NcrSeverity.MEDIUM,
      priority: NcrPriority.HIGH,
      dateReported: new Date(),
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

async function ensureEmergencyPreparedness(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    referenceNo: string;
    scenario: string;
    emergencyType: EmergencyPreparednessType;
    potentialImpact: string;
    responseSummary?: string;
    resourceSummary?: string;
    ownerUserId?: string;
    drillFrequencyMonths?: number;
    nextDrillDate?: Date;
    status?: EmergencyPreparednessStatus;
  }
) {
  return (getEmergencyPreparednessDelegate(prisma) as any).upsert({
    where: {
      tenantId_referenceNo: {
        tenantId: params.tenantId,
        referenceNo: params.referenceNo
      }
    },
    update: {
      scenario: params.scenario,
      emergencyType: params.emergencyType,
      potentialImpact: params.potentialImpact,
      responseSummary: params.responseSummary,
      resourceSummary: params.resourceSummary,
      ownerUserId: params.ownerUserId,
      drillFrequencyMonths: params.drillFrequencyMonths,
      nextDrillDate: params.nextDrillDate,
      status: params.status ?? EmergencyPreparednessStatus.ACTIVE,
      deletedAt: null
    },
    create: {
      tenantId: params.tenantId,
      referenceNo: params.referenceNo,
      scenario: params.scenario,
      emergencyType: params.emergencyType,
      potentialImpact: params.potentialImpact,
      responseSummary: params.responseSummary,
      resourceSummary: params.resourceSummary,
      ownerUserId: params.ownerUserId,
      drillFrequencyMonths: params.drillFrequencyMonths,
      nextDrillDate: params.nextDrillDate,
      status: params.status ?? EmergencyPreparednessStatus.ACTIVE
    }
  });
}

async function ensureEmergencyPreparednessLink(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    emergencyId: string;
    linkType: 'PROCESS' | 'RISK' | 'ACTION' | 'INCIDENT';
    linkedId: string;
    createdById?: string;
    note?: string;
  }
) {
  return (getEmergencyPreparednessLinkDelegate(prisma) as any).upsert({
    where: {
      emergencyId_linkType_linkedId: {
        emergencyId: params.emergencyId,
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
      emergencyId: params.emergencyId,
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
  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      tenantId_email: {
        tenantId: params.tenantId,
        email: 'admin@demo.local'
      }
    }
  });

  const qualityManager = await prisma.user.findUniqueOrThrow({
    where: {
      tenantId_email: {
        tenantId: params.tenantId,
        email: 'quality.manager@demo.local'
      }
    }
  });

  const internalAuditor = await prisma.user.findUniqueOrThrow({
    where: {
      tenantId_email: {
        tenantId: params.tenantId,
        email: 'internal.auditor@demo.local'
      }
    }
  });

  const operationsSupervisor = await prisma.user.findUniqueOrThrow({
    where: {
      tenantId_email: {
        tenantId: params.tenantId,
        email: 'ops.supervisor@demo.local'
      }
    }
  });

  const salesManager = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'sales.manager@demo.local',
    firstName: 'Sara',
    lastName: 'Hasanli',
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

  const hrManager = await ensureUser(prisma, {
    tenantId: params.tenantId,
    email: 'hr.manager@demo.local',
    firstName: 'Laman',
    lastName: 'Mammadova',
    roleId: params.roleIds.get('Manager'),
    passwordHash: params.passwordHash
  });

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: params.tenantId } });
  if (tenant.name === 'Demo Tenant') {
    await prisma.tenant.update({
      where: { id: params.tenantId },
      data: { name: 'DigitX Manufacturing' }
    });
  }

  await ensureTenantSetting(
    prisma,
    params.tenantId,
    'organization.companyName',
    'DigitX Manufacturing',
    ['Demo Tenant', 'Integrated Management System']
  );
  await ensureTenantSetting(prisma, params.tenantId, 'industry', 'Precision metal components manufacturing');
  await ensureTenantSetting(prisma, params.tenantId, 'location', 'Baku, Azerbaijan');

  const internalIssue1 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.INTERNAL,
    title: 'Operator onboarding records are inconsistent across shifts',
    description: 'Production and warehouse supervisors use different onboarding checklists, which makes competence evidence difficult to verify.',
    category: 'People and competence',
    status: ContextIssueStatus.OPEN
  });
  const internalIssue2 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.INTERNAL,
    title: 'Supplier performance reviews are still tracked manually',
    description: 'Procurement maintains supplier evaluations in spreadsheets, causing delays in trend review and follow-up.',
    category: 'Process and capability',
    status: ContextIssueStatus.MONITORING
  });
  const externalIssue1 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.EXTERNAL,
    title: 'Lead times for imported electronic components remain volatile',
    description: 'Critical control-board parts have unstable availability, affecting production planning and customer commitments.',
    category: 'Supplier and supply chain',
    status: ContextIssueStatus.OPEN
  });
  const externalIssue2 = await ensureContextIssue(prisma, {
    tenantId: params.tenantId,
    type: ContextIssueType.EXTERNAL,
    title: 'Customers are requesting stronger product traceability evidence',
    description: 'Key customers now expect faster access to batch traceability and process release records during audits.',
    category: 'Market and customer',
    status: ContextIssueStatus.OPEN
  });

  const salesProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-PR-001',
    name: 'Sales',
    purpose: 'Review customer requirements and commit only to feasible delivery and quality conditions.',
    ownerUserId: salesManager.id,
    department: 'Commercial',
    scope: 'From customer inquiry and quotation through order review and handover to production planning.',
    inputsText: 'Customer forecasts, drawings, specifications, commercial terms',
    outputsText: 'Approved quotations, reviewed orders, customer communication records'
  });
  const procurementProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-PR-002',
    name: 'Procurement',
    purpose: 'Select and manage suppliers that can consistently meet DigitX quality and delivery requirements.',
    ownerUserId: procurementLead.id,
    department: 'Supply Chain',
    scope: 'From supplier approval and purchasing through supplier review and incoming coordination.',
    inputsText: 'Approved supplier list, material demand plan, specifications, performance data',
    outputsText: 'Purchase orders, supplier evaluations, approved external provider records'
  });
  const productionProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-PR-003',
    name: 'Production',
    purpose: 'Manufacture precision components consistently to customer and regulatory requirements.',
    ownerUserId: operationsSupervisor.id,
    department: 'Operations',
    scope: 'From job release, setup, and in-process control through final release and batch traceability.',
    inputsText: 'Released orders, approved work instructions, calibrated equipment, trained operators',
    outputsText: 'Finished components, inspection records, traceability data, release decisions'
  });
  const hrProcess = await ensureProcess(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-PR-004',
    name: 'HR',
    purpose: 'Maintain competence, awareness, and staffing support for business-critical IMS processes.',
    ownerUserId: hrManager.id,
    department: 'Human Resources',
    scope: 'From recruitment and onboarding through training, competence review, and awareness refresh.',
    inputsText: 'Role profiles, staffing needs, training plan, competence gaps',
    outputsText: 'Onboarding records, training completion evidence, competence evaluations'
  });

  const supplierRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Single-source supplier delay could interrupt control board production',
    description: 'One approved supplier provides the control boards used in DigitX premium assemblies, and current lead times remain unstable.',
    category: 'Supply Chain',
    likelihood: 4,
    severity: 5,
    existingControls: 'Weekly supplier expediting, safety stock on top-selling product lines, approved substitute component review in progress.',
    plannedMitigationActions: 'Qualify a secondary supplier and formalize monthly supplier performance review meetings.',
    residualLikelihood: 3,
    residualImpact: 4,
    issueContextType: RiskIssueContextType.EXTERNAL,
    issueContext: externalIssue1.title,
    ownerId: procurementLead.id,
    targetDate: toDate('2026-05-15'),
    status: RiskStatus.IN_TREATMENT
  });
  const traceabilityRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Traceability gaps may delay customer complaint response',
    description: 'Production and final release records are not yet retrieved fast enough for key customer audit and complaint scenarios.',
    category: 'Quality',
    likelihood: 3,
    severity: 5,
    existingControls: 'Manual batch records, final inspection release log, supervisor review before shipment.',
    plannedMitigationActions: 'Digitize batch record indexing and standardize lot-level release retrieval.',
    residualLikelihood: 2,
    residualImpact: 4,
    issueContextType: RiskIssueContextType.EXTERNAL,
    issueContext: externalIssue2.title,
    ownerId: qualityManager.id,
    targetDate: toDate('2026-05-30'),
    status: RiskStatus.IN_TREATMENT
  });
  const competenceRisk = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Incomplete onboarding evidence could leave operators unverified for critical tasks',
    description: 'Training records for newly assigned operators are not always captured consistently across shifts.',
    category: 'Health and Safety',
    likelihood: 3,
    severity: 4,
    existingControls: 'Line supervisor checklists, periodic HR training tracker review.',
    plannedMitigationActions: 'Standardize onboarding checklist sign-off and introduce monthly competence review with HR.',
    residualLikelihood: 2,
    residualImpact: 3,
    issueContextType: RiskIssueContextType.INTERNAL,
    issueContext: internalIssue1.title,
    ownerId: hrManager.id,
    targetDate: toDate('2026-05-20'),
    status: RiskStatus.OPEN
  });
  const digitalOpportunity = await ensureRisk(prisma, {
    tenantId: params.tenantId,
    title: 'Opportunity to digitize supplier and training records',
    description: 'A shared digital evidence workflow would improve supplier review visibility and competence traceability across DigitX.',
    category: 'Digital Enablement',
    likelihood: 2,
    severity: 3,
    existingControls: 'Separate spreadsheets exist in Procurement and HR for periodic review.',
    plannedMitigationActions: 'Pilot a shared digital register for supplier evaluations and onboarding evidence.',
    residualLikelihood: 1,
    residualImpact: 2,
    issueContextType: RiskIssueContextType.INTERNAL,
    issueContext: internalIssue2.title,
    ownerId: qualityManager.id,
    targetDate: toDate('2026-06-10'),
    status: RiskStatus.ACCEPTED
  });

  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: externalIssue1.id, riskId: supplierRisk.id, createdById: admin.id });
  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: externalIssue2.id, riskId: traceabilityRisk.id, createdById: admin.id });
  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: internalIssue1.id, riskId: competenceRisk.id, createdById: admin.id });
  await ensureContextIssueRiskLink(prisma, { tenantId: params.tenantId, issueId: internalIssue2.id, riskId: digitalOpportunity.id, createdById: admin.id });

  const salesDocument = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'DTX-PRO-001',
    title: 'Sales Order Review Procedure',
    type: 'Procedure',
    summary: 'Defines how customer requirements, delivery commitments, and technical changes are reviewed before order acceptance.',
    ownerId: salesManager.id,
    effectiveDate: toDate('2026-01-10'),
    reviewDueDate: toDate('2027-01-10')
  });
  const procurementDocument = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'DTX-PRO-002',
    title: 'Supplier Selection and Evaluation Procedure',
    type: 'Procedure',
    summary: 'Defines supplier approval, periodic evaluation, and escalation for delivery or quality performance issues.',
    ownerId: procurementLead.id,
    effectiveDate: toDate('2026-01-12'),
    reviewDueDate: toDate('2027-01-12')
  });
  const productionDocument = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'DTX-PRO-003',
    title: 'Production Traceability and Release Procedure',
    type: 'Procedure',
    summary: 'Defines batch traceability, in-process verification, final release, and retention of production evidence.',
    ownerId: operationsSupervisor.id,
    effectiveDate: toDate('2026-01-15'),
    reviewDueDate: toDate('2027-01-15')
  });
  const hrDocument = await ensureDocument(prisma, {
    tenantId: params.tenantId,
    code: 'DTX-PRO-004',
    title: 'Competence, Training, and Awareness Procedure',
    type: 'Procedure',
    summary: 'Defines onboarding, competence evaluation, refresher training, and evidence retention for operational roles.',
    ownerId: hrManager.id,
    effectiveDate: toDate('2026-01-18'),
    reviewDueDate: toDate('2027-01-18')
  });

  const audit = await ensureAudit(prisma, {
    tenantId: params.tenantId,
    code: 'DTX-IA-2026-01',
    title: 'Internal Audit - Production and Supplier Control',
    type: 'INTERNAL_AUDIT',
    standard: 'ISO 9001',
    scope: 'Production planning, traceability controls, supplier evaluation, and competence evidence for critical operations.',
    leadAuditorId: internalAuditor.id,
    auditeeArea: 'Production and Procurement',
    scheduledAt: toDate('2026-03-10'),
    startedAt: toDate('2026-03-12'),
    completedAt: toDate('2026-03-12'),
    summary: 'The audit confirmed a generally controlled process environment, with improvement needs in supplier evaluation cadence, operator competence evidence, and traceability record retrieval.',
    conclusion: 'The processes are functional but require targeted corrective action to improve consistency of evidence and supplier oversight.',
    recommendations: 'Standardize evaluation cadence, digitize traceability retrieval, and reinforce onboarding evidence controls.'
  });
  const supplierAudit = await ensureAudit(prisma, {
    tenantId: params.tenantId,
    code: 'DTX-SA-2026-01',
    title: 'Supplier Audit - TraceBoard Electronics',
    type: 'SUPPLIER_AUDIT',
    standard: 'ISO 9001',
    scope: 'Critical control-board supplier capability, traceability, and change-notification controls.',
    leadAuditorId: internalAuditor.id,
    auditeeArea: 'Critical Supplier Control',
    scheduledAt: toDate('2026-02-18'),
    startedAt: toDate('2026-02-18'),
    completedAt: toDate('2026-02-18'),
    summary: 'The supplier audit confirmed capable delivery performance, with improvement needs around formal change notification and retention of traceability evidence packs.',
    conclusion: 'The supplier remains approved, with follow-up needed to strengthen documented change-notification and traceability review controls.',
    recommendations: 'Formalize supplier change notification and verify quarterly traceability pack review.'
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
    { clause: '4', response: AuditChecklistResponse.YES, notes: 'Operational context and interested parties are defined and reviewed during management review.' },
    { clause: '5', response: AuditChecklistResponse.PARTIAL, notes: 'Process owners understand priorities, but documented follow-up from supplier review meetings is inconsistent.' },
    { clause: '6', response: AuditChecklistResponse.YES, notes: 'Key operational risks are defined and followed through the risk register.' },
    { clause: '7', response: AuditChecklistResponse.NO, notes: 'Recent operator onboarding records were missing supervisor sign-off on two critical workstations.' },
    { clause: '8', response: AuditChecklistResponse.NO, notes: 'Supplier evaluation records were overdue for one strategic component provider and traceability retrieval relied on manual searches.' },
    { clause: '9', response: AuditChecklistResponse.YES, notes: 'Internal audit and KPI review evidence is available and current.' },
    { clause: '10', response: AuditChecklistResponse.YES, notes: 'Corrective action follow-up is visible and management review tracks improvement priorities.' }
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

  const finding1 = await ensureAuditFinding(prisma, {
    tenantId: params.tenantId,
    auditId: audit.id,
    checklistItemId: checklistItems.get('5')?.id,
    clause: '5',
    title: 'Supplier review meeting actions are not consistently documented',
    description: 'Evidence of management follow-up exists, but meeting outputs for strategic supplier reviews are not recorded consistently, reducing visibility of responsibilities and timing.',
    severity: AuditFindingSeverity.OBSERVATION,
    ownerId: qualityManager.id,
    dueDate: toDate('2026-04-20'),
    status: AuditFindingStatus.OPEN
  });
  const finding2 = await ensureAuditFinding(prisma, {
    tenantId: params.tenantId,
    auditId: audit.id,
    checklistItemId: checklistItems.get('7')?.id,
    clause: '7',
    title: 'Operator onboarding evidence is incomplete for critical workstations',
    description: 'Two sampled onboarding records for CNC operators were missing supervisor sign-off confirming competence before independent work.',
    severity: AuditFindingSeverity.MINOR,
    ownerId: hrManager.id,
    dueDate: toDate('2026-04-18'),
    status: AuditFindingStatus.CAPA_CREATED
  });
  const finding3 = await ensureAuditFinding(prisma, {
    tenantId: params.tenantId,
    auditId: audit.id,
    checklistItemId: checklistItems.get('8')?.id,
    clause: '8',
    title: 'Strategic supplier evaluations are overdue and traceability retrieval is slow',
    description: 'The latest evaluation for a strategic control-board supplier was overdue, and batch traceability evidence required multiple manual lookups during sampling.',
    severity: AuditFindingSeverity.MAJOR,
    ownerId: procurementLead.id,
    dueDate: toDate('2026-04-15'),
    status: AuditFindingStatus.CAPA_CREATED
  });

  const ncr1 = await ensureNcr(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-NCR-001',
    title: 'Incomplete operator onboarding evidence for CNC line',
    description: `Raised from audit ${audit.code}, finding: ${finding2.title}. Competence verification records were incomplete before independent operation.`,
    reportedByUserId: internalAuditor.id,
    ownerUserId: hrManager.id,
    department: 'Human Resources',
    location: 'CNC Line',
    dueDate: toDate('2026-04-25'),
    containmentAction: 'Line supervisor reviewed active operator files and suspended unsigned training packs from release.',
    investigationSummary: 'Onboarding sign-off was completed verbally but not transferred to the master training file.',
    rootCause: 'The onboarding workflow relies on manual handover between supervisors and HR without a single controlled checklist.',
    correctiveActionSummary: 'Introduce one controlled onboarding checklist with supervisor and HR verification before release to work.',
    status: NcrStatus.ACTION_IN_PROGRESS
  });
  const ncr2 = await ensureNcr(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-NCR-002',
    title: 'Supplier evaluation and traceability control gaps',
    description: `Raised from audit ${audit.code}, finding: ${finding3.title}. Supplier performance review and batch evidence retrieval were not controlled at the expected level.`,
    reportedByUserId: internalAuditor.id,
    ownerUserId: procurementLead.id,
    department: 'Supply Chain',
    location: 'Procurement / Production Planning',
    dueDate: toDate('2026-04-22'),
    containmentAction: 'Procurement completed an immediate supplier review and Quality assembled the latest batch records for affected product families.',
    investigationSummary: 'Supplier review reminders are manual and traceability files are stored in multiple folders without a retrieval index.',
    rootCause: 'The process depends on local spreadsheet tracking and decentralized evidence storage.',
    correctiveActionSummary: 'Introduce a monthly supplier review calendar and a controlled batch record index for finished assemblies.',
    status: NcrStatus.ACTION_IN_PROGRESS
  });

  const ncrAction1 = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'ncr',
    sourceId: ncr1.id,
    title: 'Standardize onboarding checklist sign-off for critical workstations',
    description: 'Roll out one controlled onboarding checklist and verify that HR receives completed evidence for each new CNC operator.',
    ownerId: hrManager.id,
    dueDate: toDate('2026-04-25'),
    status: ActionItemStatus.IN_PROGRESS
  });
  const ncrAction2 = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'ncr',
    sourceId: ncr2.id,
    title: 'Reinstate monthly review cycle for strategic suppliers',
    description: 'Reintroduce a fixed review cadence and capture actions for quality and delivery performance issues.',
    ownerId: procurementLead.id,
    dueDate: toDate('2026-04-22'),
    status: ActionItemStatus.OPEN
  });
  const riskAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'risk',
    sourceId: supplierRisk.id,
    title: 'Qualify secondary control-board supplier',
    description: 'Approve an alternative supplier for critical control boards to reduce exposure from unstable import lead times.',
    ownerId: procurementLead.id,
    dueDate: toDate('2026-05-15'),
    status: ActionItemStatus.IN_PROGRESS
  });

  const environmentalObligation = await ensureComplianceObligation(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-CO-001',
    title: 'Waste handling and disposal conditions are reviewed and retained',
    sourceName: 'Environmental permit conditions',
    obligationType: 'Regulatory',
    jurisdiction: 'Azerbaijan',
    description: 'DigitX must maintain controlled review and retention of waste handling, storage, and disposal evidence for regulated material streams.',
    ownerUserId: qualityManager.id,
    reviewFrequencyMonths: 12,
    nextReviewDate: toDate('2026-12-15'),
    status: ComplianceObligationStatus.ACTIVE
  });
  const customerObligation = await ensureComplianceObligation(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-CO-002',
    title: 'Customer traceability and supplier control requirements are maintained',
    sourceName: 'Customer quality agreement',
    obligationType: 'Customer',
    jurisdiction: 'Key account requirements',
    description: 'Traceability retrieval and supplier control requirements from strategic customers must be reflected in procurement and production controls.',
    ownerUserId: procurementLead.id,
    reviewFrequencyMonths: 6,
    nextReviewDate: toDate('2026-09-15'),
    status: ComplianceObligationStatus.UNDER_REVIEW
  });
  const competenceObligation = await ensureComplianceObligation(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-CO-003',
    title: 'Competence evidence is retained for critical operational roles',
    sourceName: 'Labour and competence requirements',
    obligationType: 'Legal',
    jurisdiction: 'Employment and safety requirements',
    description: 'DigitX must retain evidence that critical operators were trained, assessed, and authorized before independent work.',
    ownerUserId: hrManager.id,
    reviewFrequencyMonths: 12,
    nextReviewDate: toDate('2026-11-30'),
    status: ComplianceObligationStatus.ACTIVE
  });

  const incident1 = await ensureIncident(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-INC-001',
    title: 'Coolant spill at SMT preparation area',
    type: 'INCIDENT',
    category: 'ENVIRONMENT',
    description: 'A coolant drum connection loosened during transfer, causing a localized spill near the SMT preparation area before production start.',
    eventDate: toDate('2026-03-28'),
    location: 'SMT Preparation Area',
    ownerUserId: operationsSupervisor.id,
    severity: 'MEDIUM',
    immediateAction: 'Area isolated, absorbent kit used, and affected material quarantined for safe disposal.',
    investigationSummary: 'Connection torque checks were not part of the pre-start transfer checklist for this station.',
    rootCause: 'Pre-start transfer checks were incomplete, so hose connection integrity relied on operator habit instead of a controlled verification step.',
    rcaMethod: 'FIVE_WHY',
    correctiveActionSummary: 'Add transfer-point checks to the startup checklist and verify spill-kit readiness during line opening.',
    status: 'ACTION_IN_PROGRESS'
  });
  const nearMiss1 = await ensureIncident(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-NM-001',
    title: 'Forklift and pedestrian near miss at finished goods dispatch',
    type: 'NEAR_MISS',
    category: 'SAFETY',
    description: 'A pedestrian entered the dispatch route while a forklift was reversing toward the finished goods staging lane. No contact occurred.',
    eventDate: toDate('2026-03-31'),
    location: 'Finished Goods Dispatch',
    ownerUserId: qualityManager.id,
    severity: 'HIGH',
    immediateAction: 'Supervisor paused dispatch movement, briefed operators, and re-marked the temporary pedestrian route.',
    investigationSummary: 'Temporary route markings were unclear during peak dispatch activity and spotter responsibility was assumed rather than assigned.',
    rootCause: 'Temporary traffic-control changes were not standardized, so dispatch teams relied on informal coordination during peak movement periods.',
    rcaMethod: 'FISHBONE',
    correctiveActionSummary: 'Clarify pedestrian segregation, assign spotter responsibility during peak dispatch windows, and confirm awareness at shift handover.',
    status: 'INVESTIGATION'
  });
  const incidentAction = await ensureActionItem(prisma, {
    tenantId: params.tenantId,
    sourceType: 'incident',
    sourceId: incident1.id,
    title: 'Reinforce coolant spill response at SMT workstation',
    description: 'Verify containment materials, reinforce operator briefing, and confirm supervisor checks for spill-ready equipment.',
    ownerId: operationsSupervisor.id,
    dueDate: toDate('2026-04-28'),
    status: ActionItemStatus.OPEN
  });
  const aspect1 = await ensureEnvironmentalAspect(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-EA-001',
    activity: 'SMT coolant handling and transfer',
    aspect: 'Coolant and chemical handling',
    impact: 'Potential localized spill, hazardous waste generation, and contamination of surrounding work areas.',
    lifecycleStage: EnvironmentalAspectStage.NORMAL_OPERATION,
    controlSummary: 'Closed transfer points, spill response kits, startup checklist, and supervisor verification during line opening.',
    significance: EnvironmentalAspectSignificance.HIGH,
    ownerUserId: operationsSupervisor.id,
    reviewDate: toDate('2026-09-30'),
    status: EnvironmentalAspectStatus.ACTIVE
  });
  const aspect2 = await ensureEnvironmentalAspect(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-EA-002',
    activity: 'Finished goods dispatch and forklift movement',
    aspect: 'Vehicle movement and temporary route changes',
    impact: 'Potential collision, near misses, and uncontrolled movement during peak dispatch periods.',
    lifecycleStage: EnvironmentalAspectStage.ABNORMAL_OPERATION,
    controlSummary: 'Marked pedestrian segregation, dispatch route briefing, temporary route control, and spotter assignment at peak periods.',
    significance: EnvironmentalAspectSignificance.MEDIUM,
    ownerUserId: qualityManager.id,
    reviewDate: toDate('2026-08-31'),
    status: EnvironmentalAspectStatus.MONITORING
  });
  const hazard1 = await ensureHazardIdentification(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-HZ-001',
    activity: 'Finished goods dispatch and forklift movement',
    hazard: 'Pedestrian and forklift route interaction',
    potentialHarm: 'Potential collision, struck-by injury, and loss of control where temporary routes are unclear.',
    exposureStage: 'ROUTINE',
    existingControls: 'Marked pedestrian segregation, shift briefing, reversing alarm checks, and supervisor review during peak dispatch periods.',
    severity: 'HIGH',
    ownerUserId: qualityManager.id,
    reviewDate: toDate('2026-08-20'),
    status: 'MONITORING'
  });
  const hazard2 = await ensureHazardIdentification(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-HZ-002',
    activity: 'SMT coolant handling and transfer',
    hazard: 'Transfer hose failure during coolant handling',
    potentialHarm: 'Slip hazard, contact exposure, and uncontrolled spill conditions during startup transfer.',
    exposureStage: 'NON_ROUTINE',
    existingControls: 'Closed transfer points, startup checklist, spill kits, and supervisor verification before line opening.',
    severity: 'HIGH',
    ownerUserId: operationsSupervisor.id,
    reviewDate: toDate('2026-09-15'),
    status: 'ACTIVE'
  });
  const emergency1 = await ensureEmergencyPreparedness(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-EP-001',
    scenario: 'Coolant spill during SMT line startup transfer',
    emergencyType: EmergencyPreparednessType.CHEMICAL_SPILL,
    potentialImpact: 'Localized spill, operator exposure, line interruption, and waste handling escalation if the spill is not contained quickly.',
    responseSummary: 'Isolate the area, stop transfer, deploy spill kit, notify the supervisor, and dispose of contaminated material under controlled handling.',
    resourceSummary: 'Spill kit at transfer point, isolation cones, emergency contact list, and startup supervisor checklist.',
    ownerUserId: operationsSupervisor.id,
    drillFrequencyMonths: 6,
    nextDrillDate: toDate('2026-08-15'),
    status: EmergencyPreparednessStatus.ACTIVE
  });
  const emergency2 = await ensureEmergencyPreparedness(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-EP-002',
    scenario: 'Pedestrian evacuation and dispatch route control during peak movement',
    emergencyType: EmergencyPreparednessType.EVACUATION,
    potentialImpact: 'Unsafe evacuation path, collision risk, and uncontrolled dispatch movement if pedestrian segregation fails during a site alarm or emergency response.',
    responseSummary: 'Pause dispatch traffic, assign route marshal, direct pedestrians to segregated assembly path, and confirm lane clearance before resuming movement.',
    resourceSummary: 'Alarm call tree, dispatch lane signage, temporary route barriers, and supervisor-led muster checklist.',
    ownerUserId: qualityManager.id,
    drillFrequencyMonths: 12,
    nextDrillDate: toDate('2026-10-10'),
    status: EmergencyPreparednessStatus.MONITORING
  });
  const provider1 = await ensureExternalProvider(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-SP-001',
    providerName: 'TraceBoard Electronics',
    providerType: 'SUPPLIER',
    suppliedScope: 'Control boards and critical traceability-labelled electronic components for production.',
    approvalBasis: 'Approved supplier based on incoming-quality history, traceability capability review, and customer-specific control requirements.',
    criticality: 'HIGH',
    ownerUserId: qualityManager.id,
    evaluationDate: toDate('2026-03-18'),
    qualityScore: 4,
    deliveryScore: 4,
    responsivenessScore: 3,
    complianceScore: 4,
    traceabilityScore: 4,
    changeControlScore: 3,
    evaluationScore: 73,
    evaluationOutcome: 'APPROVED_WITH_CONDITIONS',
    evaluationSummary: 'Annual supplier evaluation confirmed acceptable quality and delivery performance, with tighter control still needed for formal change notification and review of traceability evidence packs.',
    nextReviewDate: toDate('2026-07-31'),
    status: 'UNDER_REVIEW'
  });
  const provider2 = await ensureExternalProvider(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-SP-002',
    providerName: 'MetroCal Services',
    providerType: 'CALIBRATION',
    suppliedScope: 'Annual calibration and certification support for production and inspection equipment.',
    approvalBasis: 'Approved based on accredited scope, on-time certification performance, and controlled certificate review.',
    criticality: 'MEDIUM',
    ownerUserId: operationsSupervisor.id,
    evaluationDate: toDate('2026-03-25'),
    qualityScore: 5,
    deliveryScore: 5,
    responsivenessScore: 4,
    complianceScore: 5,
    traceabilityScore: 4,
    changeControlScore: 4,
    evaluationScore: 90,
    evaluationOutcome: 'APPROVED',
    evaluationSummary: 'Annual evaluation confirmed strong accredited calibration support, timely certification turnaround, and consistent document control.',
    nextReviewDate: toDate('2026-09-15'),
    status: 'APPROVED'
  });
  const changeRequest1 = await ensureChangeRequest(prisma, {
    tenantId: params.tenantId,
    referenceNo: 'DTX-MOC-001',
    title: 'Introduce secondary supplier for critical control boards',
    changeType: 'MATERIAL',
    reason: 'Single-source exposure remains high for traceability-labelled control boards, and the annual supplier review still shows dependency risk on the primary provider.',
    affectedArea: 'Procurement, incoming inspection, production release',
    proposedChange: 'Qualify a secondary supplier, update incoming verification criteria, and revise release controls before approved use in live production.',
    impactSummary: 'The change affects supplier approval, incoming verification, customer traceability expectations, and production-release confidence during the transition period.',
    controlSummary: 'Keep the existing approved supplier in place until qualification is complete, update the supplier-control procedure, review the linked risk, and verify traceability evidence before implementation.',
    ownerUserId: qualityManager.id,
    targetImplementationDate: toDate('2026-07-15'),
    reviewDate: toDate('2026-05-20'),
    status: 'REVIEWING'
  });

  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: salesProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: salesDocument.id, createdById: admin.id, note: 'Primary procedure for customer requirement review.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: salesProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: traceabilityRisk.id, createdById: admin.id, note: 'Customer traceability expectations affect order confidence.' });

  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: procurementDocument.id, createdById: admin.id, note: 'Core supplier control procedure.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: supplierRisk.id, createdById: admin.id, note: 'Primary procurement continuity risk.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.AUDIT, linkedId: audit.id, createdById: admin.id, note: 'Internal audit covered supplier control.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.NCR, linkedId: ncr2.id, createdById: admin.id, note: 'NCR raised from supplier evaluation and traceability finding.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.ACTION, linkedId: ncrAction2.id, createdById: admin.id, note: 'Corrective action to restore supplier review cadence.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: procurementProcess.id, linkType: ProcessRegisterLinkType.ACTION, linkedId: riskAction.id, createdById: admin.id, note: 'Risk mitigation action for second-source qualification.' });

  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: productionProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: productionDocument.id, createdById: admin.id, note: 'Controlled production and traceability procedure.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: productionProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: traceabilityRisk.id, createdById: admin.id, note: 'Traceability response risk for production and release.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: productionProcess.id, linkType: ProcessRegisterLinkType.AUDIT, linkedId: audit.id, createdById: admin.id, note: 'Internal audit covered production controls.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: productionProcess.id, linkType: ProcessRegisterLinkType.NCR, linkedId: ncr2.id, createdById: admin.id, note: 'NCR impacts production traceability control.' });

  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: hrProcess.id, linkType: ProcessRegisterLinkType.DOCUMENT, linkedId: hrDocument.id, createdById: admin.id, note: 'Controlled competence and awareness procedure.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: hrProcess.id, linkType: ProcessRegisterLinkType.RISK, linkedId: competenceRisk.id, createdById: admin.id, note: 'Competence evidence risk linked to onboarding control.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: hrProcess.id, linkType: ProcessRegisterLinkType.NCR, linkedId: ncr1.id, createdById: admin.id, note: 'NCR raised from onboarding evidence gap.' });
  await ensureProcessLink(prisma, { tenantId: params.tenantId, processId: hrProcess.id, linkType: ProcessRegisterLinkType.ACTION, linkedId: ncrAction1.id, createdById: admin.id, note: 'Corrective action to standardize onboarding evidence.' });

  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: environmentalObligation.id,
    linkType: ComplianceObligationLinkType.PROCESS,
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production controls carry the operating requirement.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: customerObligation.id,
    linkType: ComplianceObligationLinkType.PROCESS,
    linkedId: procurementProcess.id,
    createdById: admin.id,
    note: 'Procurement owns supplier-control expectations from the customer agreement.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: customerObligation.id,
    linkType: ComplianceObligationLinkType.RISK,
    linkedId: supplierRisk.id,
    createdById: admin.id,
    note: 'Supplier continuity and control are the main exposure points.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: customerObligation.id,
    linkType: ComplianceObligationLinkType.AUDIT,
    linkedId: audit.id,
    createdById: admin.id,
    note: 'The internal audit reviewed supplier and traceability control.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: customerObligation.id,
    linkType: ComplianceObligationLinkType.ACTION,
    linkedId: riskAction.id,
    createdById: admin.id,
    note: 'Supplier qualification is a direct follow-up action.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: competenceObligation.id,
    linkType: ComplianceObligationLinkType.PROCESS,
    linkedId: hrProcess.id,
    createdById: admin.id,
    note: 'HR owns the competence evidence process.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: competenceObligation.id,
    linkType: ComplianceObligationLinkType.RISK,
    linkedId: competenceRisk.id,
    createdById: admin.id,
    note: 'Competence evidence gaps are already tracked as an operational risk.'
  });
  await ensureComplianceObligationLink(prisma, {
    tenantId: params.tenantId,
    obligationId: competenceObligation.id,
    linkType: ComplianceObligationLinkType.ACTION,
    linkedId: ncrAction1.id,
    createdById: admin.id,
    note: 'This action standardizes onboarding evidence retention.'
  });

  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: incident1.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production owns the station controls affected by the spill.'
  });
  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: incident1.id,
    linkType: 'RISK',
    linkedId: digitalOpportunity.id,
    createdById: admin.id,
    note: 'The incident supports the case for more structured digital line checks.'
  });
  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: incident1.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'Follow-up action to prevent repeat spill conditions.'
  });
  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: nearMiss1.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production and dispatch controls are the operational area affected by the near miss.'
  });
  await ensureIncidentLink(prisma, {
    tenantId: params.tenantId,
    incidentId: nearMiss1.id,
    linkType: 'RISK',
    linkedId: competenceRisk.id,
    createdById: admin.id,
    note: 'Near misses highlight the need for clearer operational awareness and role clarity.'
  });
  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect1.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production owns the station controls managing coolant transfer.'
  });
  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect1.id,
    linkType: 'RISK',
    linkedId: digitalOpportunity.id,
    createdById: admin.id,
    note: 'Structured digital checks reduce the exposure highlighted by the spill event.'
  });
  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect1.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'Incident follow-up action also strengthens the aspect control.'
  });
  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect2.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Dispatch routing and movement control sit within the production and dispatch interface.'
  });
  await ensureEnvironmentalAspectLink(prisma, {
    tenantId: params.tenantId,
    aspectId: aspect2.id,
    linkType: 'ACTION',
    linkedId: ncrAction1.id,
    createdById: admin.id,
    note: 'Operator discipline and route-control awareness are reinforced through follow-up action.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard1.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Dispatch route control sits in the production and dispatch interface.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard1.id,
    linkType: 'INCIDENT',
    linkedId: nearMiss1.id,
    createdById: admin.id,
    note: 'The near miss demonstrates the live exposure if route control weakens.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard1.id,
    linkType: 'RISK',
    linkedId: competenceRisk.id,
    createdById: admin.id,
    note: 'Operational awareness and role clarity are already tracked as a linked risk.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard2.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production owns the startup transfer control at the SMT area.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard2.id,
    linkType: 'INCIDENT',
    linkedId: incident1.id,
    createdById: admin.id,
    note: 'The coolant spill incident is the closest real event tied to this hazard.'
  });
  await ensureHazardIdentificationLink(prisma, {
    tenantId: params.tenantId,
    hazardId: hazard2.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'Incident follow-up action is also the immediate control improvement for this hazard.'
  });
  await ensureEmergencyPreparednessLink(prisma, {
    tenantId: params.tenantId,
    emergencyId: emergency1.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production owns the startup transfer area and first response controls.'
  });
  await ensureEmergencyPreparednessLink(prisma, {
    tenantId: params.tenantId,
    emergencyId: emergency1.id,
    linkType: 'INCIDENT',
    linkedId: incident1.id,
    createdById: admin.id,
    note: 'This spill incident is the live event that the response scenario is built around.'
  });
  await ensureEmergencyPreparednessLink(prisma, {
    tenantId: params.tenantId,
    emergencyId: emergency1.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'The action strengthens preparedness at the same transfer point.'
  });
  await ensureEmergencyPreparednessLink(prisma, {
    tenantId: params.tenantId,
    emergencyId: emergency2.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'The dispatch interface and route control sit inside the production process.'
  });
  await ensureEmergencyPreparednessLink(prisma, {
    tenantId: params.tenantId,
    emergencyId: emergency2.id,
    linkType: 'INCIDENT',
    linkedId: nearMiss1.id,
    createdById: admin.id,
    note: 'The near miss shows why evacuation and dispatch route separation needs rehearsal.'
  });
  await ensureEmergencyPreparednessLink(prisma, {
    tenantId: params.tenantId,
    emergencyId: emergency2.id,
    linkType: 'RISK',
    linkedId: competenceRisk.id,
    createdById: admin.id,
    note: 'Awareness and role clarity remain part of the wider operational risk picture.'
  });

  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider1.id,
    linkType: 'PROCESS',
    linkedId: procurementProcess.id,
    createdById: admin.id,
    note: 'Procurement owns approval and ongoing supplier-control review.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider1.id,
    linkType: 'RISK',
    linkedId: supplierRisk.id,
    createdById: admin.id,
    note: 'Single-source dependency and supplier-control exposure are tracked in the Risk register.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider1.id,
    linkType: 'AUDIT',
    linkedId: audit.id,
    createdById: admin.id,
    note: 'Internal audit reviewed supplier evaluation and traceability control.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider1.id,
    linkType: 'AUDIT',
    linkedId: supplierAudit.id,
    createdById: admin.id,
    note: 'Annual supplier audit supports the formal review requirement for this critical supplier.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider1.id,
    linkType: 'ACTION',
    linkedId: riskAction.id,
    createdById: admin.id,
    note: 'Second-source qualification action reduces dependence on this supplier.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider1.id,
    linkType: 'OBLIGATION',
    linkedId: customerObligation.id,
    createdById: admin.id,
    note: 'Customer-specific traceability and supplier-control expectations apply to this provider.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider2.id,
    linkType: 'PROCESS',
    linkedId: productionProcess.id,
    createdById: admin.id,
    note: 'Production equipment reliability depends on controlled calibration support.'
  });
  await ensureExternalProviderLink(prisma, {
    tenantId: params.tenantId,
    providerId: provider2.id,
    linkType: 'ACTION',
    linkedId: incidentAction.id,
    createdById: admin.id,
    note: 'Equipment readiness and spill-prevention follow-up share the same operational control owner.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest1.id,
    linkType: 'PROCESS',
    linkedId: procurementProcess.id,
    createdById: admin.id,
    note: 'Procurement owns supplier qualification and approval of the second source.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest1.id,
    linkType: 'RISK',
    linkedId: supplierRisk.id,
    createdById: admin.id,
    note: 'The linked risk explains the continuity and control exposure behind the change.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest1.id,
    linkType: 'ACTION',
    linkedId: riskAction.id,
    createdById: admin.id,
    note: 'Existing mitigation action already covers secondary-source qualification work.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest1.id,
    linkType: 'DOCUMENT',
    linkedId: procurementDocument.id,
    createdById: admin.id,
    note: 'The supplier-control procedure needs review before the change is implemented.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest1.id,
    linkType: 'OBLIGATION',
    linkedId: customerObligation.id,
    createdById: admin.id,
    note: 'Customer-specific traceability and supplier-control expectations remain part of the review.'
  });
  await ensureChangeRequestLink(prisma, {
    tenantId: params.tenantId,
    changeId: changeRequest1.id,
    linkType: 'PROVIDER',
    linkedId: provider1.id,
    createdById: admin.id,
    note: 'The current critical supplier remains part of the review until the second source is qualified.'
  });

  await prisma.auditFinding.updateMany({
    where: {
      id: finding1.id
    },
    data: {
      status: AuditFindingStatus.OPEN
    }
  });
}
