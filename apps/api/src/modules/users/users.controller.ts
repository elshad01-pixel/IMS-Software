import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Permissions } from '../../common/auth/permissions.decorator';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentTenant } from '../../common/tenancy/current-tenant.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.read')
  list(@CurrentTenant() tenantId: string) {
    return this.usersService.list(tenantId);
  }

  @Get('roles')
  @Permissions('users.read')
  roles(@CurrentTenant() tenantId: string) {
    return this.usersService.roles(tenantId);
  }

  @Get(':id')
  @Permissions('users.read')
  detail(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.detail(tenantId, id);
  }

  @Post()
  @Permissions('users.write')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateUserDto
  ) {
    return this.usersService.create(tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions('users.write')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ) {
    return this.usersService.update(tenantId, user.sub, id, dto);
  }
}
