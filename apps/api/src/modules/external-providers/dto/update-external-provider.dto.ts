import { PartialType } from '@nestjs/swagger';
import { CreateExternalProviderDto } from './create-external-provider.dto';

export class UpdateExternalProviderDto extends PartialType(CreateExternalProviderDto) {}
