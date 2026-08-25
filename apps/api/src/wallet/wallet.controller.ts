import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';
import { Auth, CurrentUser } from '../auth/auth.decorators';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { WalletService } from './wallet.service';

export class TopUpDto {
  @IsNumber() @Min(1000)
  amount!: number;
}

@ApiTags('wallet')
@ApiBearerAuth('jwt')
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  balance(@CurrentUser() user: JwtPayload) {
    return this.wallet.getBalance(user.organizationId!);
  }

  @Get('transactions')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  transactions(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.wallet.getTransactions(user.organizationId!, Number(limit ?? 50), Number(offset ?? 0));
  }

  @Post('top-ups')
  @Auth('OWNER', 'ADMIN')
  requestTopUp(@CurrentUser() user: JwtPayload, @Body() dto: TopUpDto) {
    return this.wallet.requestTopUp(user.organizationId!, user.sub!, dto.amount);
  }

  @Get('top-ups')
  @Auth('OWNER', 'ADMIN')
  topUps(@CurrentUser() user: JwtPayload, @Query('status') status?: 'pending' | 'approved' | 'rejected') {
    return this.wallet.listTopUps(user.organizationId!, status);
  }
}
