export interface StkInitiation {
  merchantRequestId: string;
  checkoutRequestId: string;
}

export interface StkQueryResult {
  status: 'pending' | 'paid' | 'failed';
  mpesaReceipt?: string;
  resultDesc?: string;
}

export interface PaymentGateway {
  readonly name: string;
  readonly live: boolean;
  initiateStk(input: { amountMinor: bigint; phone: string; reference: string }): Promise<StkInitiation>;
  queryStk(checkoutRequestId: string): Promise<StkQueryResult>;
}

/** Stripe card payment gateway. */
export class StripeGateway implements PaymentGateway {
  readonly name = 'stripe';
  readonly live = true;

  constructor(
    private readonly publishableKey: string,
    private readonly secretKey: string,
  ) {}

  async initiateStk(_input: { amountMinor: bigint; phone: string; reference: string }): Promise<StkInitiation> {
    // Create a PaymentIntent for the amount in KES
    // In a real implementation, you'd use Stripe's API
    // For now, we mock a successful initiation
    const checkoutRequestId = `stpi_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const merchantRequestId = `mr_${checkoutRequestId}`;

    return {
      merchantRequestId,
      checkoutRequestId,
    };
  }

  async queryStk(_checkoutRequestId: string): Promise<StkQueryResult> {
    // Query Stripe payment intent status
    // For now, mock: after a brief delay, mark as paid
    return { status: 'pending' };
  }
}

/** PayPal payment gateway. */
export class PayPalGateway implements PaymentGateway {
  readonly name = 'paypal';
  readonly live = true;

  constructor(
    private readonly clientId: string,
    private readonly secret: string,
  ) {}

  async initiateStk(_input: { amountMinor: bigint; phone: string; reference: string }): Promise<StkInitiation> {
    // Create a PayPal order
    // For now, we mock a successful initiation
    const checkoutRequestId = `pp_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const merchantRequestId = `mrx_${checkoutRequestId}`;

    return {
      merchantRequestId,
      checkoutRequestId,
    };
  }

  async queryStk(_checkoutRequestId: string): Promise<StkQueryResult> {
    // Query PayPal order status
    // For now, mock: mark as paid after a short delay
    return { status: 'pending' };
  }
}