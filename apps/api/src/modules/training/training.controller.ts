import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateTrainingAssignmentDto } from './dto/create-training-assignment.dto';
import { CreateTrainingDto } from './dto/create-training.dto';
import { UpdateTrainingAssignmentDto } from './dto/update-training-assignment.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';
import { TrainingService } from './training.service';

@ApiTags('training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('training')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get()
  @Permissions('training.read')
  list(@CurrentTenant() tenantId: string) {
    return this.trainingService.list(tenantId);
  }

  @Get(':id')
  @Permissions('training.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.trainingService.get(tenantId, id);
  }

  @Post()
  @Permissions('training.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateTrainingDto
  ) {
    return this.trainingService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('training.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateTrainingDto
  ) {
    return this.trainingService.update(tenantId, user.sub, id, dto);
  }

  @Post(':id/assignments')
  @Permissions('training.write')
  addAssignment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateTrainingAssignmentDto
  ) {
    return this.trainingService.addAssignment(tenantId, user.sub, id, dto);
  }

  @Patch('assignments/:assignmentId')
  @Permissions('training.write')
  updateAssignment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateTrainingAssignmentDto
  ) {
    return this.trainingService.updateAssignment(tenantId, user.sub, assignmentId, dto);
  }
}
