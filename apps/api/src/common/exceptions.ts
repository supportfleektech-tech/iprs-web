import { HttpException, HttpStatus } from '@nestjs/common';

/** 402 Payment Required — wallet balance insufficient for a billable check. */
export class InsufficientFundsException extends HttpException {
  constructor(message = 'Insufficient wallet balance') {
    super({ code: 'INSUFFICIENT_FUNDS', message }, HttpStatus.PAYMENT_REQUIRED);
  }
}
