import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRequest } from '../tenancy/tenant-request.interface';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<TenantRequest>();
  return request.user;
});
