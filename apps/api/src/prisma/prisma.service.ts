import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getPrisma, encryptField, decryptField } from '@fleek/database';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly prisma = getPrisma();

  get client() {
    return this.prisma;
  }

  encrypt = encryptField;
  decrypt = decryptField;

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
