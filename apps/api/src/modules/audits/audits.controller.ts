import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateAuditChecklistItemDto } from './dto/create-audit-checklist-item.dto';
import { CreateAuditChecklistQuestionDto } from './dto/create-audit-checklist-question.dto';
import { CreateAuditDto } from './dto/create-audit.dto';
import { CreateAuditFindingDto } from './dto/create-audit-finding.dto';
import { CreateCapaFromFindingDto } from './dto/create-capa-from-finding.dto';
import { ReorderAuditChecklistQuestionsDto } from './dto/reorder-audit-checklist-questions.dto';
import { UpdateAuditChecklistItemDto } from './dto/update-audit-checklist-item.dto';
import { UpdateAuditChecklistQuestionDto } from './dto/update-audit-checklist-question.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { UpdateAuditFindingDto } from './dto/update-audit-finding.dto';
import { AuditsService } from './audits.service';

@ApiTags('audits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audits')
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  @Permissions('audits.read')
  list(@CurrentTenant() tenantId: string) {
    return this.auditsService.list(tenantId);
  }

  @Get('checklist-questions')
  @Permissions('audits.read')
  listChecklistQuestions(
    @CurrentTenant() tenantId: string,
    @Query('standard') standard?: string,
    @Query('clause') clause?: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    return this.auditsService.listChecklistQuestions(
      tenantId,
      standard,
      clause,
      includeInactive === 'true'
    );
  }

  @Get(':id')
  @Permissions('audits.read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.auditsService.get(tenantId, id);
  }

  @Post()
  @Permissions('audits.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateAuditDto
  ) {
    return this.auditsService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('audits.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateAuditDto
  ) {
    return this.auditsService.update(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions('admin.delete')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.auditsService.remove(tenantId, user.sub, id);
  }

  @Patch(':id/archive')
  @Permissions('admin.delete')
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string
  ) {
    return this.auditsService.archive(tenantId, user.sub, id);
  }

  @Post('checklist-questions')
  @Permissions('audits.write')
  createChecklistQuestion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateAuditChecklistQuestionDto
  ) {
    return this.auditsService.createChecklistQuestion(tenantId, user.sub, dto);
  }

  @Patch('checklist-questions/reorder')
  @Permissions('audits.write')
  reorderChecklistQuestions(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: ReorderAuditChecklistQuestionsDto
  ) {
    return this.auditsService.reorderChecklistQuestions(tenantId, user.sub, dto);
  }

  @Patch('checklist-questions/:questionId')
  @Permissions('audits.write')
  updateChecklistQuestion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('questionId') questionId: string,
    @Body() dto: UpdateAuditChecklistQuestionDto
  ) {
    return this.auditsService.updateChecklistQuestion(tenantId, user.sub, questionId, dto);
  }

  @Patch('checklist-questions/:questionId/archive')
  @Permissions('audits.write')
  archiveChecklistQuestion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('questionId') questionId: string
  ) {
    return this.auditsService.archiveChecklistQuestion(tenantId, user.sub, questionId);
  }

  @Delete('checklist-questions/:questionId')
  @Permissions('audits.write')
  removeChecklistQuestion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('questionId') questionId: string
  ) {
    return this.auditsService.removeChecklistQuestion(tenantId, user.sub, questionId);
  }

  @Post(':id/checklist-items')
  @Permissions('audits.write')
  addChecklistItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') auditId: string,
    @Body() dto: CreateAuditChecklistItemDto
  ) {
    return this.auditsService.addChecklistItem(tenantId, user.sub, auditId, dto);
  }

  @Patch('checklist-items/:itemId')
  @Permissions('audits.write')
  updateChecklistItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('itemId') itemId: string,
    @Body() dto: UpdateAuditChecklistItemDto
  ) {
    return this.auditsService.updateChecklistItem(tenantId, user.sub, itemId, dto);
  }

  @Delete('checklist-items/:itemId')
  @Permissions('audits.write')
  removeChecklistItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('itemId') itemId: string
  ) {
    return this.auditsService.removeChecklistItem(tenantId, user.sub, itemId);
  }

  @Post(':id/findings')
  @Permissions('audits.write')
  addFinding(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') auditId: string,
    @Body() dto: CreateAuditFindingDto
  ) {
    return this.auditsService.addFinding(tenantId, user.sub, auditId, dto);
  }

  @Patch('findings/:findingId')
  @Permissions('audits.write')
  updateFinding(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('findingId') findingId: string,
    @Body() dto: UpdateAuditFindingDto
  ) {
    return this.auditsService.updateFinding(tenantId, user.sub, findingId, dto);
  }

  @Post('findings/:findingId/create-capa')
  @Permissions('audits.write')
  createCapaFromFinding(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('findingId') findingId: string,
    @Body() dto: CreateCapaFromFindingDto
  ) {
    return this.auditsService.createCapaFromFinding(tenantId, user.sub, findingId, dto);
  }
}
