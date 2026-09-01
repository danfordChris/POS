// Request augmentation: correlation id attached by CorrelationIdMiddleware.
import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export {};
