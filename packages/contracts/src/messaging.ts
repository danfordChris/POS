import { randomUUID } from 'node:crypto';
import { MessageEnvelope } from './envelope.js';

/** A message delivered to a subscriber. `ack`/`nak`/`term` drive JetStream redelivery. */
export interface BusMessage<T = unknown> {
  subject: string;
  data: T;
  headers: Record<string, string>;
  /** 1-based delivery attempt for this consumer. */
  deliveryCount: number;
  ack(): Promise<void>;
  /** Negative-ack: redeliver after `delayMs` (best effort). */
  nak(delayMs?: number): Promise<void>;
  /** Terminate: stop redelivering this message. */
  term(): Promise<void>;
}

export interface PublishOptions {
  headers?: Record<string, string>;
  /** Dedupe id for at-least-once producers (JetStream `msgID`). */
  msgId?: string;
}

export interface SubscribeOptions {
  /** Durable consumer name — required so redelivery survives restarts. */
  durable: string;
  /** Queue group for competing consumers (horizontal scale). */
  queue?: string;
  /** Max delivery attempts before the message is considered poisoned. */
  maxDeliver?: number;
  ackWaitMs?: number;
}

export interface Subscription {
  unsubscribe(): Promise<void>;
}

/** Transport-agnostic messaging surface. Implemented by the NATS adapter and the in-memory test double. */
export interface MessageBus {
  publish(subject: string, data: unknown, opts?: PublishOptions): Promise<void>;
  subscribe(
    subject: string,
    handler: (msg: BusMessage) => Promise<void>,
    opts: SubscribeOptions,
  ): Promise<Subscription>;
  request<T = unknown>(subject: string, data: unknown, timeoutMs?: number): Promise<T>;
  reply(
    subject: string,
    handler: (data: unknown) => Promise<unknown>,
    opts?: { queue?: string },
  ): Promise<Subscription>;
  drain(): Promise<void>;
}

export class RpcTimeoutError extends Error {
  constructor(subject: string, timeoutMs: number) {
    super(`RPC to '${subject}' timed out after ${timeoutMs}ms`);
    this.name = 'RpcTimeoutError';
  }
}

export const DEFAULT_RPC_TIMEOUT_MS = 2000;

/** Wrap a domain payload in the standard message envelope. */
export function makeEnvelope(input: {
  producer: string;
  businessId: string | null;
  schemaVersion: string;
  payload: unknown;
  eventId?: string;
  occurredAt?: string;
}): MessageEnvelope & { payload: unknown } {
  return {
    event_id: input.eventId ?? randomUUID(),
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    business_id: input.businessId,
    producer: input.producer,
    schema_version: input.schemaVersion,
    payload: input.payload,
  };
}
