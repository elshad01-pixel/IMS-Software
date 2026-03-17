import { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  tenantId: string;
  email: string;
  permissions: string[];
  roleId?: string;
}

export interface TenantRequest extends Request {
  tenantId?: string;
  user?: AuthenticatedUser;
}
