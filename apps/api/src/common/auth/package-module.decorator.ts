import { SetMetadata } from '@nestjs/common';
import { PackageModuleKey } from './package-entitlements';

export const PACKAGE_MODULE_KEY = 'packageModule';

export const PackageModule = (moduleKey: PackageModuleKey) => SetMetadata(PACKAGE_MODULE_KEY, moduleKey);
