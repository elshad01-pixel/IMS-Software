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
