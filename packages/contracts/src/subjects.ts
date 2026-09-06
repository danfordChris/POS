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
  catalog: {
    categoryUpserted: evtSubject('catalog', 'CategoryUpserted'),
    productUpserted: evtSubject('catalog', 'ProductUpserted'),
    priceChanged: evtSubject('catalog', 'PriceChanged'),
    productDeactivated: evtSubject('catalog', 'ProductDeactivated'),
  },
  inventory: {
    reserveStock: rpcSubject('inventory', 'reserveStock'),
    commitReservation: rpcSubject('inventory', 'commitReservation'),
    releaseReservation: rpcSubject('inventory', 'releaseReservation'),
    alertConfigChanged: evtSubject('inventory', 'AlertConfigChanged'),
    stockMovementRecorded: evtSubject('inventory', 'StockMovementRecorded'),
    stockLevelChanged: evtSubject('inventory', 'StockLevelChanged'),
    stockFellBelowThreshold: evtSubject('inventory', 'StockFellBelowThreshold'),
    stockRecovered: evtSubject('inventory', 'StockRecovered'),
  },
  sales: {
    saleCompleted: evtSubject('sales', 'SaleCompleted'),
    saleVoided: evtSubject('sales', 'SaleVoided'),
  },
  winger: {
    wingerAuthorized: evtSubject('winger', 'WingerAuthorized'),
    wingerSuspended: evtSubject('winger', 'WingerSuspended'),
  },
  notifications: {
    notificationSent: evtSubject('notifications', 'NotificationSent'),
    notificationFailed: evtSubject('notifications', 'NotificationFailed'),
  },
} as const;
