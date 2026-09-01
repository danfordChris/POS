/** NATS subject builders. Events: `pos.evt.<context>.<Event>`. RPC: `pos.rpc.<context>.<Method>`. */

export type Context =
  'identity' | 'tenancy' | 'catalog' | 'inventory' | 'sales' | 'winger' | 'notifications';

export const evtSubject = (context: Context, event: string): string =>
  `pos.evt.${context}.${event}`;
export const rpcSubject = (context: Context, method: string): string =>
  `pos.rpc.${context}.${method}`;
export const dlqSubject = (context: Context, event: string): string =>
  `pos.dlq.${context}.${event}`;

export const streamName = (context: Context): string => context.toUpperCase();

export const SUBJECTS = {
  identity: {
    userRegistered: evtSubject('identity', 'UserRegistered'),
    getUser: rpcSubject('identity', 'getUser'),
    verifyToken: rpcSubject('identity', 'verifyToken'),
  },
  tenancy: {
    businessCreated: evtSubject('tenancy', 'BusinessCreated'),
    membershipCreated: evtSubject('tenancy', 'MembershipCreated'),
    membershipSuspended: evtSubject('tenancy', 'MembershipSuspended'),
    invitationCreated: evtSubject('tenancy', 'InvitationCreated'),
    invitationAccepted: evtSubject('tenancy', 'InvitationAccepted'),
    resolveMembership: rpcSubject('tenancy', 'resolveMembership'),
  },
  inventory: {
    reserveStock: rpcSubject('inventory', 'reserveStock'),
    commitReservation: rpcSubject('inventory', 'commitReservation'),
    releaseReservation: rpcSubject('inventory', 'releaseReservation'),
    stockFellBelowThreshold: evtSubject('inventory', 'StockFellBelowThreshold'),
    stockLevelChanged: evtSubject('inventory', 'StockLevelChanged'),
  },
} as const;
