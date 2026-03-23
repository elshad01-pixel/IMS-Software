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
