import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '@agendaflow/shared';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      tenantId?: string;
    }>();

    const user = request.user;
    if (!user) return true; // JwtAuthGuard já trata isso

    if (!user.companyId) {
      this.logger.error(`Token sem companyId para usuário ${user.id}`);
      throw new ForbiddenException('Token inválido: companyId ausente');
    }

    // Injeta o tenantId na request para uso nos services
    request.tenantId = user.companyId;
    return true;
  }
}
