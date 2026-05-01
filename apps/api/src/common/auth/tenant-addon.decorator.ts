import { SetMetadata } from '@nestjs/common';
import { TenantAddOnKey } from './tenant-addons';

export const TENANT_ADD_ON_KEY = 'tenantAddOn';

export const TenantAddOn = (addOn: TenantAddOnKey) => SetMetadata(TENANT_ADD_ON_KEY, addOn);

