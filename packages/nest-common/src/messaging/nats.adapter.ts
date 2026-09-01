import { Logger } from '@nestjs/common';
import {
  connect,
  JSONCodec,
  type NatsConnection,
  type Subscription as NatsSubscription,
} from 'nats';
import {
  BusMessage,
  DEFAULT_RPC_TIMEOUT_MS,
  MessageBus,
  PublishOptions,
  RpcTimeoutError,
  SubscribeOptions,
  Subscription,
} from '@pos/contracts';

const codec = JSONCodec();

/**
 * NATS-backed {@link MessageBus}.
 *
 * Core pub/sub + request/reply are wired here. Durable JetStream consumers with
 * real `ack`/`nak`/`deliveryCount` are layered in during T-0112 (needs a running
 * broker from T-0111); until then `ack`/`nak`/`term` are no-ops and
 * `deliveryCount` is 1. All retry / DLQ / outbox logic in this package is
 * transport-agnostic and covered by the in-memory bus tests.
 */
export class NatsCoreBus implements MessageBus {
  private readonly logger = new Logger(NatsCoreBus.name);
  private readonly subs = new Set<NatsSubscription>();

  private constructor(private readonly nc: NatsConnection) {}

  static async connect(servers: string, name?: string): Promise<NatsCoreBus> {
    const nc = await connect({ servers, name });
    return new NatsCoreBus(nc);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async publish(subject: string, data: unknown, _opts?: PublishOptions): Promise<void> {
    // JetStream publish with msgID + headers is added in T-0112.
    this.nc.publish(subject, codec.encode(data));
  }

  async subscribe(
    subject: string,
    handler: (msg: BusMessage) => Promise<void>,
    opts: SubscribeOptions,
  ): Promise<Subscription> {
    const sub = this.nc.subscribe(subject, { queue: opts.queue });
    this.subs.add(sub);

    void (async () => {
      for await (const m of sub) {
        const message: BusMessage = {
          subject: m.subject,
          data: codec.decode(m.data),
          headers: {},
          deliveryCount: 1,
          ack: async () => undefined,
          nak: async () => undefined,
          term: async () => undefined,
        };
        try {
          await handler(message);
        } catch (error) {
          this.logger.error(
            `handler for ${subject} threw: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    })();

    return {
      unsubscribe: async () => {
        sub.unsubscribe();
        this.subs.delete(sub);
      },
    };
  }

  async request<T = unknown>(
    subject: string,
    data: unknown,
    timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS,
  ): Promise<T> {
    try {
      const reply = await this.nc.request(subject, codec.encode(data), { timeout: timeoutMs });
      return codec.decode(reply.data) as T;
    } catch {
      throw new RpcTimeoutError(subject, timeoutMs);
    }
  }

  async reply(
    subject: string,
    handler: (data: unknown) => Promise<unknown>,
    opts?: { queue?: string },
  ): Promise<Subscription> {
    const sub = this.nc.subscribe(subject, { queue: opts?.queue });
    this.subs.add(sub);

    void (async () => {
      for await (const m of sub) {
        try {
          const result = await handler(codec.decode(m.data));
          m.respond(codec.encode(result));
        } catch (error) {
          m.respond(
            codec.encode({ error: error instanceof Error ? error.message : String(error) }),
          );
        }
      }
    })();

    return {
      unsubscribe: async () => {
        sub.unsubscribe();
        this.subs.delete(sub);
      },
    };
  }

  async drain(): Promise<void> {
    await this.nc.drain();
  }
}
