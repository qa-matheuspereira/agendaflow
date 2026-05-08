import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@agendaflow/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '@agendaflow/shared';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('Usuário não autenticado');

    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 100,
      [UserRole.ADMIN]: 80,
      [UserRole.MANAGER]: 60,
      [UserRole.RECEPTIONIST]: 40,
    };

    const userLevel = roleHierarchy[user.role] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => roleHierarchy[r] ?? 0));

    if (userLevel < minRequired) {
      throw new ForbiddenException('Permissão insuficiente para esta ação');
    }

    return true;
  }
}
