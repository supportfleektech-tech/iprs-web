import { Controller, Get, Param, Query, Res, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { VerificationType, VERIFICATION_TYPES } from '@fleek/types';
import { Auth, CurrentUser } from '../../auth/auth.decorators';
import { ExportService } from '../exports/export.service';

@ApiTags('exports')
@ApiBearerAuth('jwt')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportService) {}

  @Get('verifications')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Export verifications (CSV/XLSX/PDF)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async exportVerifications(
    @CurrentUser() user: { organizationId: string },
    @Query('format') format: 'csv' | 'xlsx' | 'pdf',
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Res() res?: Response,
  ) {
    if (!format || !['csv', 'xlsx', 'pdf'].includes(format)) {
      throw new BadRequestException('format must be csv, xlsx, or pdf');
    }

    const result = await this.exports.exportVerifications({
      format,
      type:
        type && (VERIFICATION_TYPES as string[]).includes(type)
          ? (type as VerificationType)
          : undefined,
      from,
      to,
      status,
      search,
      organizationId: user.organizationId,
    });

    if (res) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    }
    return result;
  }

  @Get('verifications/batch/:batchId')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Export batch results (CSV/XLSX/PDF)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'], required: true })
  async exportBatch(
    @CurrentUser() user: { organizationId: string },
    @Param('batchId') batchId: string,
    @Query('format') format: 'csv' | 'xlsx' | 'pdf',
    @Res() res?: Response,
  ) {
    if (!format || !['csv', 'xlsx', 'pdf'].includes(format)) {
      throw new BadRequestException('format must be csv, xlsx, or pdf');
    }

    const result = await this.exports.exportBatch({
      format,
      batchId,
      organizationId: user.organizationId,
    });

    if (res) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    }
    return result;
  }

  @Get('wallet/statement')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Export wallet statement (CSV/XLSX/PDF)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  async exportWalletStatement(
    @CurrentUser() user: { organizationId: string },
    @Query('format') format: 'csv' | 'xlsx' | 'pdf',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    if (!format || !['csv', 'xlsx', 'pdf'].includes(format)) {
      throw new BadRequestException('format must be csv, xlsx, or pdf');
    }

    const result = await this.exports.exportWalletStatement({
      format,
      organizationId: user.organizationId,
      from,
      to,
    });

    if (res) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    }
    return result;
  }

  @Get('verifications/:id/certificate')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Download verification certificate (PDF)' })
  async downloadCertificate(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Res() res?: Response,
  ) {
    const result = await this.exports.generateVerificationCertificate({
      verificationId: id,
      organizationId: user.organizationId,
    });

    if (res) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    }
    return result;
  }
}
