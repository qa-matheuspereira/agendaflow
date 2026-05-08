import { Controller, Get, Patch, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';
import { UpdateWhatsappConfigDto } from './dto/update-whatsapp-config.dto';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import { UserRole } from '@agendaflow/shared';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@Roles(UserRole.ADMIN)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('business-rules')
  @ApiOperation({ summary: 'Obter regras de negócio' })
  getBusinessRules(@CurrentTenant() companyId: string) {
    return this.service.getBusinessRules(companyId);
  }

  @Patch('business-rules')
  @ApiOperation({ summary: 'Atualizar regras de negócio' })
  updateBusinessRules(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBusinessRulesDto,
  ) {
    return this.service.updateBusinessRules(companyId, dto, userId);
  }

  @Get('whatsapp')
  @ApiOperation({ summary: 'Obter configurações WhatsApp' })
  getWhatsappConfig(@CurrentTenant() companyId: string) {
    return this.service.getWhatsappConfig(companyId);
  }

  @Patch('whatsapp')
  @ApiOperation({ summary: 'Atualizar configurações WhatsApp' })
  updateWhatsappConfig(
    @CurrentTenant() companyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateWhatsappConfigDto,
  ) {
    return this.service.updateWhatsappConfig(companyId, dto, userId);
  }

  @Get('whatsapp/connection')
  @ApiOperation({ summary: 'Status de conexão WhatsApp (live)' })
  getConnectionStatus(@CurrentTenant() companyId: string) {
    return this.service.getConnectionStatus(companyId);
  }

  @Post('whatsapp/qr')
  @ApiOperation({ summary: 'Gerar QR Code para conexão WhatsApp' })
  generateQr(@CurrentTenant() companyId: string) {
    return this.service.generateQr(companyId);
  }

  @Post('whatsapp/disconnect')
  @ApiOperation({ summary: 'Desconectar instância WhatsApp' })
  disconnectWhatsapp(@CurrentTenant() companyId: string) {
    return this.service.disconnectWhatsapp(companyId);
  }
}
