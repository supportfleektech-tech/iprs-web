import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { JwtAuthGuard, type JwtPayload } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import type { UserRole } from '@fleek/types';

export const ROLES_KEY = 'fleek_roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => ctx.switchToHttp().getRequest()['user'],
);

export function Auth(...roles: UserRole[]) {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), ...(roles.length ? [Roles(...roles)] : []));
}
