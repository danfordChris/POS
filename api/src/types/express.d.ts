// Request augmentation.
import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned by CorrelationIdMiddleware. */
      requestId?: string;
      /** Authenticated user subject, set by UserAuthGuard. */
      user?: { id: string };
      /** Authenticated operator subject, set by OperatorAuthGuard. */
      operator?: { id: string };
      /** Tenant membership resolved by TenantGuard. */
      membership?: { businessId: string; role: string };
    }
  }
}

export {};
