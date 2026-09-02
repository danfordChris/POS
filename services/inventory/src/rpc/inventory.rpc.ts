import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { MESSAGE_BUS } from '@pos/nest-common';
import {
  SUBJECTS,
  commitReservationRequest,
  releaseReservationRequest,
  reserveStockRequest,
  type MessageBus,
} from '@pos/contracts';
import { StockService } from '../stock/stock.service.js';

/** inventory's NATS request/reply handlers — the stock reservation saga steps
 * called by `sales`. All idempotent on `reservation_id`. */
@Injectable()
export class InventoryRpc implements OnApplicationBootstrap {
  private readonly logger = new Logger(InventoryRpc.name);

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly stock: StockService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.reply(SUBJECTS.inventory.reserveStock, async (raw) => {
      const { business_id, reservation_id, lines } =
        reserveStockRequest.parse(raw);
      return this.stock.reserve(business_id, reservation_id, lines);
    });

    await this.bus.reply(SUBJECTS.inventory.commitReservation, async (raw) => {
      const { business_id, reservation_id, sale_id } =
        commitReservationRequest.parse(raw);
      return this.stock.commit(business_id, reservation_id, sale_id);
    });

    await this.bus.reply(SUBJECTS.inventory.releaseReservation, async (raw) => {
      const { business_id, reservation_id } =
        releaseReservationRequest.parse(raw);
      return this.stock.release(business_id, reservation_id);
    });

    this.logger.log(
      'RPC handlers registered (reserveStock, commitReservation, releaseReservation)',
    );
  }
}
