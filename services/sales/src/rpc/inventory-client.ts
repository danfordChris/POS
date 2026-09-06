import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MESSAGE_BUS } from '@pos/nest-common';
import {
  SUBJECTS,
  commitReservationResponse,
  releaseReservationResponse,
  reserveStockResponse,
  type MessageBus,
} from '@pos/contracts';
import { z } from 'zod';

export interface ReserveLine {
  product_id: string;
  quantity: number;
}
export type ReserveResult = z.infer<typeof reserveStockResponse>;

const RPC_TIMEOUT_MS = 3000;

/** Thin client for inventory's reservation saga RPC. A transport failure
 * (timeout / no responder) becomes a `503 upstream_unavailable`; a valid
 * `{ ok: false }` is returned to the caller to shape. */
@Injectable()
export class InventoryClient {
  private readonly logger = new Logger(InventoryClient.name);

  constructor(@Inject(MESSAGE_BUS) private readonly bus: MessageBus) {}

  async reserveStock(input: {
    business_id: string;
    reservation_id: string;
    lines: ReserveLine[];
  }): Promise<ReserveResult> {
    const raw = await this.call(SUBJECTS.inventory.reserveStock, input);
    return reserveStockResponse.parse(raw);
  }

  async commitReservation(input: {
    business_id: string;
    reservation_id: string;
    sale_id: string;
  }): Promise<{ ok: boolean }> {
    const raw = await this.call(SUBJECTS.inventory.commitReservation, input);
    return commitReservationResponse.parse(raw);
  }

  async releaseReservation(input: {
    business_id: string;
    reservation_id: string;
  }): Promise<{ ok: boolean }> {
    const raw = await this.call(SUBJECTS.inventory.releaseReservation, input);
    return releaseReservationResponse.parse(raw);
  }

  private async call(subject: string, data: unknown): Promise<unknown> {
    try {
      return await this.bus.request(subject, data, RPC_TIMEOUT_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`RPC ${subject} failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Stock service is unavailable. Try again shortly.',
        devMessage: `${subject}: ${message}`,
      });
    }
  }
}
