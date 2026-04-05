import {
  ActionItemStatus,
  AuditChecklistResponse,
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditStatus,
  ContextIssueStatus,
  ContextIssueType,
  DocumentStatus,
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
import { getAuditChecklistQuestionDelegate } from '../src/common/prisma/prisma-delegate-compat';

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

  await prisma.auditFinding.updateMany({
    where: {
      id: finding1.id
    },
    data: {
      status: AuditFindingStatus.OPEN
    }
  });
}
