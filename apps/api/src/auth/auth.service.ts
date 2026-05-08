import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/database/prisma.service';
import type { AuthenticatedUser, JwtPayload, LoginResponse } from '@agendaflow/shared';
import { UserRole } from '@agendaflow/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      role: user.role as unknown as UserRole,
    };
  }

  async login(user: AuthenticatedUser): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiry', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiry', '7d'),
    });

    // Salva hash do refresh token no banco para invalidação
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), refreshToken: refreshHash },
    });

    this.logger.log(`Login: ${user.email} (${user.companyId})`);

    return { accessToken, refreshToken, user };
  }

  async refreshTokens(token: string): Promise<LoginResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        role: true,
        refreshToken: true,
      },
    });

    if (!user?.refreshToken) throw new UnauthorizedException('Sessão inválida');

    const isValid = await bcrypt.compare(token, user.refreshToken);
    if (!isValid) throw new UnauthorizedException('Refresh token inválido');

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      role: user.role as unknown as UserRole,
    };

    return this.login(authenticatedUser);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}
