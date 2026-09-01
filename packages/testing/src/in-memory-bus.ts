import {
  BusMessage,
  DEFAULT_RPC_TIMEOUT_MS,
  MessageBus,
  PublishOptions,
  RpcTimeoutError,
  SubscribeOptions,
  Subscription,
} from '@pos/contracts';

interface Registered {
  subject: string;
  handler: (msg: BusMessage) => Promise<void>;
  opts: SubscribeOptions;
  deliveries: Map<string, number>;
  active: boolean;
}

interface Responder {
  subject: string;
  handler: (data: unknown) => Promise<unknown>;
  active: boolean;
}

let counter = 0;
const nextId = (): string => `m-${Date.now()}-${(counter += 1)}`;

/** NATS `a.b.*` / `a.b.>` subject matching. */
export function subjectMatches(pattern: string, subject: string): boolean {
  if (pattern === subject) return true;
  const p = pattern.split('.');
  const s = subject.split('.');
  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === '>') return true;
    if (p[i] === '*') {
      if (s[i] === undefined) return false;
      continue;
    }
    if (p[i] !== s[i]) return false;
  }
  return p.length === s.length;
}

/**
 * In-process {@link MessageBus} for tests. Redelivery on `nak` is simulated up to
 * `maxDeliver`. Call `await bus.flush()` to drain all pending deliveries.
 */
export class InMemoryBus implements MessageBus {
  private readonly subs: Registered[] = [];
  private readonly responders: Responder[] = [];
  private pending: Promise<void>[] = [];

  publishes: { subject: string; data: unknown; opts?: PublishOptions }[] = [];

  async publish(subject: string, data: unknown, opts?: PublishOptions): Promise<void> {
    this.publishes.push({ subject, data, opts });
    const msgId = opts?.msgId ?? nextId();
    for (const sub of this.subs) {
      if (sub.active && subjectMatches(sub.subject, subject)) {
        this.deliver(sub, subject, data, opts?.headers ?? {}, msgId);
      }
    }
  }

  private deliver(
    sub: Registered,
    subject: string,
    data: unknown,
    headers: Record<string, string>,
    msgId: string,
  ): void {
    const attempt = (sub.deliveries.get(msgId) ?? 0) + 1;
    sub.deliveries.set(msgId, attempt);

    const task = (async () => {
      const msg: BusMessage = {
        subject,
        data,
        headers,
        deliveryCount: attempt,
        ack: async () => undefined,
        nak: async () => {
          const max = sub.opts.maxDeliver ?? 5;
          if (attempt < max) this.deliver(sub, subject, data, headers, msgId);
        },
        term: async () => undefined,
      };
      await sub.handler(msg);
    })();
    this.pending.push(task.catch(() => undefined));
  }

  async subscribe(
    subject: string,
    handler: (msg: BusMessage) => Promise<void>,
    opts: SubscribeOptions,
  ): Promise<Subscription> {
    const entry: Registered = { subject, handler, opts, deliveries: new Map(), active: true };
    this.subs.push(entry);
    return { unsubscribe: async () => void (entry.active = false) };
  }

  async request<T = unknown>(
    subject: string,
    data: unknown,
    timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS,
  ): Promise<T> {
    const responder = this.responders.find((r) => r.active && subjectMatches(r.subject, subject));
    if (!responder) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs, 20)));
      throw new RpcTimeoutError(subject, timeoutMs);
    }
    return (await responder.handler(data)) as T;
  }

  async reply(
    subject: string,
    handler: (data: unknown) => Promise<unknown>,
  ): Promise<Subscription> {
    const entry: Responder = { subject, handler, active: true };
    this.responders.push(entry);
    return { unsubscribe: async () => void (entry.active = false) };
  }

  async drain(): Promise<void> {
    await this.flush();
    this.subs.length = 0;
    this.responders.length = 0;
  }

  /** Resolve once every queued delivery (including `nak` redeliveries) has run. */
  async flush(): Promise<void> {
    while (this.pending.length > 0) {
      const batch = this.pending;
      this.pending = [];
      await Promise.all(batch);
    }
  }
}
