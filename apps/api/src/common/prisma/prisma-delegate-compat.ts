import { PrismaClient } from '@prisma/client';

type AuditChecklistQuestionDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  count(args?: unknown): Promise<number>;
  createMany(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
  updateMany(args: unknown): Promise<any>;
};

type ProcessRegisterDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ProcessRegisterLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ComplianceObligationDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ComplianceObligationLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type IncidentDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type IncidentLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type EnvironmentalAspectDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type EnvironmentalAspectLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type HazardIdentificationDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type HazardIdentificationLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type EmergencyPreparednessDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type EmergencyPreparednessLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ExternalProviderControlDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ExternalProviderLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ChangeRequestDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ChangeRequestLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
};

type ContextIssueDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
  count(args?: unknown): Promise<number>;
};

type InterestedPartyDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
  count(args?: unknown): Promise<number>;
};

type NeedExpectationDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
  count(args?: unknown): Promise<number>;
};

type ContextIssueRiskLinkDelegate = {
  findMany(args?: unknown): Promise<any[]>;
  create(args: unknown): Promise<any>;
  delete(args: unknown): Promise<any>;
  findFirst(args?: unknown): Promise<any>;
  count(args?: unknown): Promise<number>;
};

/**
 * Temporary Prisma delegate compatibility shim.
 *
 * Why this exists:
 * The generated Prisma runtime and d.ts expose `auditChecklistQuestion`,
 * but the Nest/TypeScript build in this workspace does not consistently
 * surface that delegate on injected Prisma client instances.
 *
 * This keeps the workaround isolated to one place instead of scattering
 * raw `as any` casts across services and seed/auth bootstrap code.
 */
export function getAuditChecklistQuestionDelegate(
  client: PrismaClient | object
): AuditChecklistQuestionDelegate {
  return (client as { auditChecklistQuestion: AuditChecklistQuestionDelegate }).auditChecklistQuestion;
}

export function getProcessRegisterDelegate(
  client: PrismaClient | object
): ProcessRegisterDelegate {
  return (client as { processRegister: ProcessRegisterDelegate }).processRegister;
}

export function getProcessRegisterLinkDelegate(
  client: PrismaClient | object
): ProcessRegisterLinkDelegate {
  return (client as { processRegisterLink: ProcessRegisterLinkDelegate }).processRegisterLink;
}

export function getComplianceObligationDelegate(
  client: PrismaClient | object
): ComplianceObligationDelegate {
  return (client as { complianceObligation: ComplianceObligationDelegate }).complianceObligation;
}

export function getComplianceObligationLinkDelegate(
  client: PrismaClient | object
): ComplianceObligationLinkDelegate {
  return (client as { complianceObligationLink: ComplianceObligationLinkDelegate }).complianceObligationLink;
}

export function getIncidentDelegate(
  client: PrismaClient | object
): IncidentDelegate {
  return (client as { incident: IncidentDelegate }).incident;
}

export function getIncidentLinkDelegate(
  client: PrismaClient | object
): IncidentLinkDelegate {
  return (client as { incidentLink: IncidentLinkDelegate }).incidentLink;
}

export function getEnvironmentalAspectDelegate(
  client: PrismaClient | object
): EnvironmentalAspectDelegate {
  return (client as { environmentalAspect: EnvironmentalAspectDelegate }).environmentalAspect;
}

export function getEnvironmentalAspectLinkDelegate(
  client: PrismaClient | object
): EnvironmentalAspectLinkDelegate {
  return (client as { environmentalAspectLink: EnvironmentalAspectLinkDelegate }).environmentalAspectLink;
}

export function getHazardIdentificationDelegate(
  client: PrismaClient | object
): HazardIdentificationDelegate {
  return (client as { hazardIdentification: HazardIdentificationDelegate }).hazardIdentification;
}

export function getHazardIdentificationLinkDelegate(
  client: PrismaClient | object
): HazardIdentificationLinkDelegate {
  return (client as { hazardIdentificationLink: HazardIdentificationLinkDelegate }).hazardIdentificationLink;
}

export function getEmergencyPreparednessDelegate(
  client: PrismaClient | object
): EmergencyPreparednessDelegate {
  return (client as { emergencyPreparedness: EmergencyPreparednessDelegate }).emergencyPreparedness;
}

export function getEmergencyPreparednessLinkDelegate(
  client: PrismaClient | object
): EmergencyPreparednessLinkDelegate {
  return (client as { emergencyPreparednessLink: EmergencyPreparednessLinkDelegate }).emergencyPreparednessLink;
}

export function getExternalProviderControlDelegate(
  client: PrismaClient | object
): ExternalProviderControlDelegate {
  return (client as { externalProviderControl: ExternalProviderControlDelegate }).externalProviderControl;
}

export function getExternalProviderLinkDelegate(
  client: PrismaClient | object
): ExternalProviderLinkDelegate {
  return (client as { externalProviderLink: ExternalProviderLinkDelegate }).externalProviderLink;
}

export function getChangeRequestDelegate(
  client: PrismaClient | object
): ChangeRequestDelegate {
  return (client as { changeRequest: ChangeRequestDelegate }).changeRequest;
}

export function getChangeRequestLinkDelegate(
  client: PrismaClient | object
): ChangeRequestLinkDelegate {
  return (client as { changeRequestLink: ChangeRequestLinkDelegate }).changeRequestLink;
}

export function getContextIssueDelegate(
  client: PrismaClient | object
): ContextIssueDelegate {
  return (client as { contextIssue: ContextIssueDelegate }).contextIssue;
}

export function getInterestedPartyDelegate(
  client: PrismaClient | object
): InterestedPartyDelegate {
  return (client as { interestedParty: InterestedPartyDelegate }).interestedParty;
}

export function getNeedExpectationDelegate(
  client: PrismaClient | object
): NeedExpectationDelegate {
  return (client as { needExpectation: NeedExpectationDelegate }).needExpectation;
}

export function getContextIssueRiskLinkDelegate(
  client: PrismaClient | object
): ContextIssueRiskLinkDelegate {
  return (client as { contextIssueRiskLink: ContextIssueRiskLinkDelegate }).contextIssueRiskLink;
}
