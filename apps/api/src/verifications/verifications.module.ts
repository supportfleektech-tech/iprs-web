import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { VerificationsController } from './verifications.controller';
import { ExportsController } from './exports/export.controller';
import { VerificationsService } from './verifications.service';
import { BatchesService } from './batches.service';
import { ExportService } from './exports/export.service';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletModule, AuthModule],
  controllers: [BatchesController, VerificationsController, ExportsController],
  providers: [VerificationsService, BatchesService, ExportService],
  exports: [VerificationsService],
})
export class VerificationsModule {}