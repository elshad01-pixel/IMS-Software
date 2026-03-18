import { PartialType } from '@nestjs/swagger';
import { CreateTrainingAssignmentDto } from './create-training-assignment.dto';

export class UpdateTrainingAssignmentDto extends PartialType(CreateTrainingAssignmentDto) {}
