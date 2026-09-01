import type { Request } from 'express';
import type { InternalContext } from '@pos/contracts';

/** Fields attached to the Express request by this package's middleware / guards. */
export type RequestWithContext = Request & {
  requestId?: string;
  internalContext?: InternalContext;
};
