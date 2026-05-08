import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '@/core/decorators/public.decorator';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { CurrentTenant } from '@/core/decorators/current-tenant.decorator';
import { PaymentsService } from './payments.service';
import { MercadopagoService } from './mercadopago.service';

interface MercadopagoWebhookBody {
  action?: string;
  data?: { id?: string };
  [key: string]: unknown;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mercadopago: MercadopagoService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar pagamentos do tenant' })
  async findAll(@CurrentTenant() companyId: string) {
    return this.paymentsService.findByCompany(companyId);
  }

  @Public()
  @Post('webhook/mercadopago')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleMercadopagoWebhook(
    @Body() payload: MercadopagoWebhookBody,
    @Headers('x-signature') signature: string,
    @Headers('x-request-id') requestId: string,
  ) {
    const dataId = payload?.data?.id ?? '';

    const isValid = this.mercadopago.validateWebhookSignature(
      signature ?? '',
      requestId ?? '',
      dataId,
    );

    if (!isValid) {
      this.logger.warn(`Invalid MP webhook signature — requestId=${requestId}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.debug(`MP webhook: action=${payload.action} dataId=${dataId}`);
    // Full processing in FASE 6
    return { received: true };
  }
}
