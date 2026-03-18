import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRequest } from './tenant-request.interface';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    return request.tenantId || request.user?.tenantId;
  }
);
