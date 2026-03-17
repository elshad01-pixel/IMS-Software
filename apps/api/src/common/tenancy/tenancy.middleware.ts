import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { TenantRequest } from './tenant-request.interface';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: TenantRequest, _res: Response, next: NextFunction) {
    req.tenantId = req.header('x-tenant-id') || req.user?.tenantId;
    next();
  }
}
