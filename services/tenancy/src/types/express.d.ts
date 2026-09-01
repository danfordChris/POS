import 'express';
import type { InternalContext } from '@pos/contracts';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      internalContext?: InternalContext;
      membership?: { businessId: string; role: string };
    }
  }
}
export {};
