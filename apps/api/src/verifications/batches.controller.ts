import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, CurrentUser } from '../auth/auth.decorators';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './bulk.dto';

@ApiTags('verifications')
@ApiBearerAuth('jwt')
@Controller('verifications/batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Post()
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create and start a bulk verification batch (max 1000 rows)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBatchDto) {
    return this.batches.createBatch(user.organizationId!, user.sub!, dto);
  }

  @Get()
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  list(@CurrentUser() user: JwtPayload) {
    return this.batches.listBatches(user.organizationId!);
  }

  @Get(':id')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  status(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.batches.getBatch(user.organizationId!, id);
  }

  @Get(':id/results')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  results(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.batches.getBatchResults(user.organizationId!, id);
  }
}
