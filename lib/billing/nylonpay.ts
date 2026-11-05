/**
 * Nylon Pay integration (spec §7.3), verified against @nile-squad/nylonpay-ts 2.2.0 (README + types):
 *   createNylonPay({ apiKey: npk_…, apiSecret: nps_… }) — sandbox vs live decided by the key.
 *   collectPayment({ amount, currency, customer: { name, phoneNumber }, description, method, reference })
 *   getStatus({ reference }) → Result<StatusResponse>
 *   createInvoice({ amount, currency, customerEmail, description, items, merchantReference }) → { paymentLink }
 *   verifyWebhookSignature({ payload: rawBody, signature: header "x-nylon-signature", secret })
 * Server only: keys never reach the browser.
 */
import { createNylonPay, verifyWebhookSignature, type NylonPaySdk, type WebhookPayload } from '@nile-squad/nylonpay-ts';

export function nylonPayConfigured(): boolean {
  return Boolean(process.env.NYLONPAY_API_KEY && process.env.NYLONPAY_API_SECRET);
}

let client: NylonPaySdk | null = null;
export function nylonpay(): NylonPaySdk {
  if (!nylonPayConfigured()) throw new Error('Nylon Pay is not configured.');
  return (client ??= createNylonPay({
    apiKey: process.env.NYLONPAY_API_KEY!,
    apiSecret: process.env.NYLONPAY_API_SECRET!,
    ...(process.env.NYLONPAY_BASE_URL ? { baseUrl: process.env.NYLONPAY_BASE_URL } : {}),
    // Never block a request polling for the customer's PIN: we poll via our own status route.
    onDelayed: 'return',
    maxPollDurationMs: 5_000,
  }));
}

export function isSandbox(): boolean {
  return (process.env.NYLONPAY_API_KEY ?? '').startsWith('npk_sandbox_') || (process.env.NYLONPAY_API_KEY ?? '').startsWith('npk_test_');
}

/** Starts a mobile-money collection. Resolves once the prompt is sent; the outcome arrives by webhook/poll. */
export async function startMobileMoneyCollection(input: { amount: number; reference: string; name: string; phone: string; description: string }) {
  const payment = await nylonpay().collectPayment({
    amount: input.amount,
    currency: 'UGX',
    method: 'mobileMoney',
    customer: { name: input.name, phoneNumber: input.phone },
    description: input.description,
    reference: input.reference,
  });
  // Swallow polling errors from the instance: status is handled by webhook + our poll route.
  payment.on('error', () => {});
  return { reference: payment.reference, status: payment.status };
}

export async function createHostedInvoice(input: { amount: number; reference: string; email: string; name: string; description: string; itemName: string; quantity: number; unitPrice: number }) {
  const r = await nylonpay().createInvoice({
    amount: input.amount,
    currency: 'UGX',
    customerEmail: input.email,
    customerName: input.name,
    description: input.description,
    items: [{ name: input.itemName, quantity: input.quantity, unitPrice: input.unitPrice }],
    merchantReference: input.reference,
  });
  if (!r.isOk) throw new Error('Could not create the payment page.');
  return { id: r.value.id, url: r.value.url ?? r.value.paymentLink };
}

export async function fetchStatus(reference: string) {
  const r = await nylonpay().getStatus({ reference });
  return r.isOk ? r.value : null;
}

export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NYLONPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  try {
    return verifyWebhookSignature({ payload: rawBody, signature, secret });
  } catch {
    return false;
  }
}

export type { WebhookPayload };
