import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
import { BatchesService } from './batches.service';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletModule, AuthModule],
  // BatchesController MUST precede VerificationsController so that
  // /verifications/batches is not captured by /verifications/:id.
  controllers: [BatchesController, VerificationsController],
  providers: [VerificationsService, BatchesService],
  exports: [VerificationsService],
})
export class VerificationsModule {}
