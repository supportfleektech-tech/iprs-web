import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

export class ContactDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional() @IsString() @MaxLength(160)
  company?: string;

  @IsString() @MinLength(10) @MaxLength(4000)
  message!: string;
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public endpoint used by the marketing site contact form. */
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submit(@Body() dto: ContactDto) {
    const saved = await this.prisma.client.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        company: dto.company ?? null,
        message: dto.message,
      },
    });
    return { ok: true, id: saved.id };
  }
}
