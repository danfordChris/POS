import { Logger } from '@nestjs/common';
import type { BusMessage, MessageBus, Subscription } from '@pos/contracts';

export interface DlqSubscribeOptions {
  durable: string;
  queue?: string;
  maxDeliver: number;
  /** Where to send a message that fails `maxDeliver` times. */
  dlqSubject: string;
  /** Base backoff; multiplied by the delivery count on each nak. */
  backoffMs?: number;
}

/**
 * Subscribe with automatic retry + dead-letter. The handler is called for each
 * delivery; on throw the message is nak'd (redelivered) until `maxDeliver`, then
 * published to `dlqSubject` and terminated.
 */
export async function subscribeWithDlq(
  bus: MessageBus,
  subject: string,
  handler: (msg: BusMessage) => Promise<void>,
  options: DlqSubscribeOptions,
): Promise<Subscription> {
  const logger = new Logger(`consumer:${options.durable}`);

  return bus.subscribe(
    subject,
    async (msg) => {
      try {
        await handler(msg);
        await msg.ack();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (msg.deliveryCount >= options.maxDeliver) {
          logger.error(`dead-lettering after ${msg.deliveryCount} attempts: ${message}`);
          await bus.publish(options.dlqSubject, msg.data, {
            headers: {
              ...msg.headers,
              'x-original-subject': subject,
              'x-error': message,
              'x-delivery-count': String(msg.deliveryCount),
            },
          });
          await msg.term();
        } else {
          await msg.nak(options.backoffMs ? options.backoffMs * msg.deliveryCount : undefined);
        }
      }
    },
    {
      durable: options.durable,
      queue: options.queue,
      maxDeliver: options.maxDeliver,
    },
  );
}
