import { Body, Controller, Get, Logger, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Auth, CurrentUser } from '../auth/auth.decorators';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

export class InitiateStkDto {
  /** Amount in KES (e.g. 5000). Minimum 100. */
  @IsNumber() @Min(100)
  amount!: number;

  /** Kenyan mobile number that will receive the STK push. */
  @IsString() @Matches(/^(\+?254|0)7\d{8}$/, { message: 'phone must be a Kenyan mobile number' })
  phone!: string;
}

export class ConfirmBankTransferDto {
  /** Amount in KES (e.g. 5000). Minimum 100. */
  @IsNumber() @Min(100)
  amount!: number;

  /** Kenyan mobile number */
  @IsString() @Matches(/^(\+?254|0)7\d{8}$/, { message: 'phone must be a Kenyan mobile number' })
  phone!: string;

  /** Paybill reference from M-Pesa confirmation SMS */
  @IsString() @Min(5)
  paybillRef!: string;
}

export class ConfirmBankPaymentDto {
  @IsBoolean()
  success!: boolean;

  @IsOptional() @IsString()
  receipt?: string;

  @IsOptional() @IsString()
  resultDesc?: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('stk')
  @Auth('OWNER', 'ADMIN')
  @ApiBearerAuth('jwt')
  async initiate(@CurrentUser() user: JwtPayload, @Body() dto: InitiateStkDto) {
    const payment = await this.payments.initiateStkPush(
      user.organizationId!,
      user.sub!,
      dto.amount,
      dto.phone,
    );
    return {
      id: payment.id,
      status: payment.status,
      merchantRequestId: payment.merchantRequestId ?? null,
      checkoutRequestId: payment.checkoutRequestId ?? null,
      message:
        this.payments.gatewayName === 'mock-gateway'
          ? 'SANDBOX MODE — payment auto-completes in a few seconds'
          : `STK push sent to ${dto.phone}. Enter your M-Pesa PIN to complete.`,
    };
  }

  @Get('stk/:id')
  @Auth('OWNER', 'ADMIN')
  @ApiBearerAuth('jwt')
  async status(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const payment = await this.prisma.client.stkPayment.findFirst({
      where: { id, organizationId: user.organizationId ?? '' },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const settled = await this.payments.syncStatus(payment);
    return {
      id: settled.id,
      status: settled.status,
      amount: Number(settled.amountMinor) / 100,
      phone: settled.phone,
      mpesaReceipt: settled.mpesaReceipt,
      resultDesc: settled.resultDesc,
      createdAt: settled.createdAt.toISOString(),
      completedAt: settled.completedAt?.toISOString() ?? null,
    };
  }

  /** Get bank/paybill details for manual transfer */
  @Get('bank-details')
  @Auth('OWNER', 'ADMIN')
  @ApiBearerAuth('jwt')
  getBankDetails() {
    return this.payments.getBankDetails();
  }

  /** Record a bank/paybill transfer initiated by user */
  @Post('bank/confirm')
  @Auth('OWNER', 'ADMIN')
  @ApiBearerAuth('jwt')
  async confirmBankTransfer(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmBankTransferDto) {
    const payment = await this.payments.confirmBankTransfer(
      user.organizationId!,
      user.sub!,
      dto.amount,
      dto.paybillRef,
      dto.phone,
    );
    return {
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amountMinor) / 100,
      phone: payment.phone,
      paybillRef: payment.paybillRef,
      message: 'Bank/Paybill transfer recorded. Wallet will be credited on confirmation.',
    };
  }

  /** Admin confirms bank payment */
  @Post('bank/:id/confirm')
  @Auth('OWNER', 'ADMIN')
  @ApiBearerAuth('jwt')
  async confirmBankPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmBankPaymentDto,
  ) {
    if (!user.isPlatformAdmin) {
      throw new NotFoundException('Only platform admins can confirm bank payments');
    }
    const payment = await this.payments.confirmBankPayment(id, dto.success, dto.receipt, dto.resultDesc);
    return {
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amountMinor) / 100,
      message: dto.success ? 'Bank payment confirmed and wallet credited' : 'Bank payment rejected',
    };
  }

  /**
   * Daraja callback (public — no auth guard on purpose).
   * The reference query param carries our payment id; payloads are validated
   * against the stored checkout request id before crediting anything.
   */
  @Post('callback')
  async callback(@Req() req: Request): Promise<{ ResultCode: number; ResultDesc: string }> {
    try {
      const reference = String(req.query.reference ?? '');
      const body = req.body as {
        Body?: {
          stkCallback?: {
            CheckoutRequestID?: string;
            ResultCode?: number;
            ResultDesc?: string;
            CallbackMetadata?: { Item?: Array<{ Name: string; Value?: unknown }> };
          };
        };
      };
      const cb = body.Body?.stkCallback;
      if (!cb?.CheckoutRequestID) throw new Error('Malformed callback');

      const receipt = cb.CallbackMetadata?.Item?.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;

      await this.payments.applyCallback({
        reference,
        checkoutRequestId: cb.CheckoutRequestID,
        success: cb.ResultCode === 0,
        mpesaReceipt: receipt != null ? String(receipt) : undefined,
        resultDesc: cb.ResultDesc,
      });
    } catch (err) {
      this.logger.warn(`callback error: ${err instanceof Error ? err.message : err}`);
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}