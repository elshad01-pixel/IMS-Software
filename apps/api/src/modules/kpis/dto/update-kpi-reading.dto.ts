import { PartialType } from '@nestjs/swagger';
import { CreateKpiReadingDto } from './create-kpi-reading.dto';

export class UpdateKpiReadingDto extends PartialType(CreateKpiReadingDto) {}
