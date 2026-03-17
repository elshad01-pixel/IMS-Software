import { IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsString()
  version!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
