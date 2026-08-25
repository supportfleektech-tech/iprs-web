import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletModule, AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
