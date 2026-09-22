import { config } from '../config.js';
import { log } from './logger.js';

export interface OutboundMessage {
  to: string;
  subject: string;
  text: string;
}
export type Transport = (msg: OutboundMessage) => Promise<void> | void;

/**
 * Delivery of OTPs and password-reset links. Plug in SMTP / SMS / an e-mail API with `setTransport`.
 * The default transport only logs; message bodies (which carry secrets) are printed solely when
 * DEV_EXPOSE_OTP is on, and that flag cannot be enabled in production.
 */
let transport: Transport = (msg) => {
  if (config.DEV_EXPOSE_OTP && !config.isTest) {
    console.log(`\n[dev mail] to=${msg.to}\n  ${msg.subject}\n  ${msg.text}\n`);
  } else if (!config.DEV_EXPOSE_OTP) {
    log.info('notify.sent', { subject: msg.subject });
  }
};

export const setTransport = (t: Transport) => {
  transport = t;
};

export async function sendMessage(msg: OutboundMessage): Promise<void> {
  try {
    await transport(msg);
  } catch (err) {
    // Delivery failures must not reveal whether an account exists; log and carry on.
    log.error('notify.failed', { subject: msg.subject, err: (err as Error).message });
  }
}

export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}
