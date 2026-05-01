import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PackageModule } from '../../common/auth/package-module.decorator';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantAddOn } from '../../common/auth/tenant-addon.decorator';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateContextIssueProcessLinkDto } from './dto/create-context-issue-process-link.dto';
import { CreateContextIssueRiskLinkDto } from './dto/create-context-issue-risk-link.dto';
import { CreateContextIssueDto } from './dto/create-context-issue.dto';
import { CreateCustomerSurveyRequestDto } from './dto/create-customer-survey-request.dto';
import { CreateInterestedPartyDto } from './dto/create-interested-party.dto';
import { CreateNeedExpectationDto } from './dto/create-need-expectation.dto';
import { SubmitCustomerSurveyDto } from './dto/submit-customer-survey.dto';
import { UpdateContextIssueDto } from './dto/update-context-issue.dto';
import { UpdateInterestedPartyDto } from './dto/update-interested-party.dto';
import { UpdateNeedExpectationDto } from './dto/update-need-expectation.dto';
import { ContextService } from './context.service';

@ApiTags('context')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@PackageModule('context')
@Controller('context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Get('dashboard')
  @Permissions('context.read')
  dashboard(@CurrentTenant() tenantId: string) {
    return this.contextService.dashboard(tenantId);
  }

  @Get('issues')
  @Permissions('context.read')
  listIssues(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: 'INTERNAL' | 'EXTERNAL',
    @Query('status') status?: 'OPEN' | 'MONITORING' | 'RESOLVED' | 'ARCHIVED',
    @Query('search') search?: string
  ) {
    return this.contextService.listIssues(tenantId, { type, status, search });
  }

  @Get('issues/:id')
  @Permissions('context.read')
  getIssue(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.contextService.getIssue(tenantId, id);
  }

  @Post('issues')
  @Permissions('context.write')
  createIssue(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateContextIssueDto) {
    return this.contextService.createIssue(tenantId, user.sub, dto);
  }

  @Patch('issues/:id')
  @Permissions('context.write')
  updateIssue(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: UpdateContextIssueDto) {
    return this.contextService.updateIssue(tenantId, user.sub, id, dto);
  }

  @Delete('issues/:id')
  @Permissions('admin.delete')
  removeIssue(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.contextService.removeIssue(tenantId, user.sub, id);
  }

  @Get('issues/:id/risk-links')
  @Permissions('context.read')
  listIssueRiskLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.contextService.listIssueRiskLinks(tenantId, id);
  }

  @Post('issues/:id/risk-links')
  @Permissions('context.write')
  addIssueRiskLink(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: CreateContextIssueRiskLinkDto) {
    return this.contextService.addIssueRiskLink(tenantId, user.sub, id, dto);
  }

  @Delete('issues/:id/risk-links/:linkId')
  @Permissions('context.write')
  removeIssueRiskLink(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Param('linkId') linkId: string) {
    return this.contextService.removeIssueRiskLink(tenantId, user.sub, id, linkId);
  }

  @Get('issues/:id/process-links')
  @Permissions('context.read')
  listIssueProcessLinks(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.contextService.listIssueProcessLinks(tenantId, id);
  }

  @Post('issues/:id/process-links')
  @Permissions('context.write')
  addIssueProcessLink(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: CreateContextIssueProcessLinkDto) {
    return this.contextService.addIssueProcessLink(tenantId, user.sub, id, dto);
  }

  @Delete('issues/:id/process-links/:linkId')
  @Permissions('context.write')
  removeIssueProcessLink(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Param('linkId') linkId: string) {
    return this.contextService.removeIssueProcessLink(tenantId, user.sub, id, linkId);
  }

  @Get('interested-parties')
  @Permissions('context.read')
  listInterestedParties(@CurrentTenant() tenantId: string, @Query('type') type?: 'CUSTOMER' | 'REGULATOR' | 'EMPLOYEE' | 'SUPPLIER' | 'OTHER', @Query('search') search?: string) {
    return this.contextService.listInterestedParties(tenantId, { type, search });
  }

  @Get('interested-parties/:id')
  @Permissions('context.read')
  getInterestedParty(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.contextService.getInterestedParty(tenantId, id);
  }

  @Post('interested-parties')
  @Permissions('context.write')
  createInterestedParty(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateInterestedPartyDto) {
    return this.contextService.createInterestedParty(tenantId, user.sub, dto);
  }

  @Patch('interested-parties/:id')
  @Permissions('context.write')
  updateInterestedParty(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: UpdateInterestedPartyDto) {
    return this.contextService.updateInterestedParty(tenantId, user.sub, id, dto);
  }

  @Post('interested-parties/:id/survey-requests')
  @Permissions('context.write')
  @TenantAddOn('customerFeedback')
  createCustomerSurveyRequest(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreateCustomerSurveyRequestDto
  ) {
    return this.contextService.createCustomerSurveyRequest(tenantId, user.sub, id, dto);
  }

  @Delete('interested-parties/:id')
  @Permissions('admin.delete')
  removeInterestedParty(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.contextService.removeInterestedParty(tenantId, user.sub, id);
  }

  @Get('needs-expectations')
  @Permissions('context.read')
  listNeeds(@CurrentTenant() tenantId: string, @Query('interestedPartyId') interestedPartyId?: string) {
    return this.contextService.listNeeds(tenantId, { interestedPartyId });
  }

  @Get('needs-expectations/:id')
  @Permissions('context.read')
  getNeed(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.contextService.getNeed(tenantId, id);
  }

  @Post('needs-expectations')
  @Permissions('context.write')
  createNeed(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateNeedExpectationDto) {
    return this.contextService.createNeed(tenantId, user.sub, dto);
  }

  @Patch('needs-expectations/:id')
  @Permissions('context.write')
  updateNeed(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: UpdateNeedExpectationDto) {
    return this.contextService.updateNeed(tenantId, user.sub, id, dto);
  }

  @Delete('needs-expectations/:id')
  @Permissions('admin.delete')
  removeNeed(@CurrentTenant() tenantId: string, @CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.contextService.removeNeed(tenantId, user.sub, id);
  }
}

@ApiTags('public-customer-surveys')
@Controller('public/customer-surveys')
export class PublicCustomerSurveyController {
  constructor(private readonly contextService: ContextService) {}

  @Get(':token')
  getSurvey(@Param('token') token: string) {
    return this.contextService.getPublicCustomerSurvey(token);
  }

  @Post(':token/submit')
  submitSurvey(@Param('token') token: string, @Body() dto: SubmitCustomerSurveyDto) {
    return this.contextService.submitPublicCustomerSurvey(token, dto);
  }
}
