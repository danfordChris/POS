// Request augmentation for the identity service.
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
    }
  }
}

export {};
