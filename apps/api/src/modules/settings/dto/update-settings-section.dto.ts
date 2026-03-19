import { IsObject } from 'class-validator';

export class UpdateSettingsSectionDto {
  @IsObject()
  values!: Record<string, unknown>;
}
