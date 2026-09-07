/** NATS subject builders. Events: `pos.evt.<context>.<Event>`. RPC: `pos.rpc.<context>.<Method>`. */

export type Context =
  'identity' | 'tenancy' | 'catalog' | 'inventory' | 'sales' | 'winger' | 'media' | 'notifications';

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
    customerCreated: evtSubject('sales', 'CustomerCreated'),
    customerUpdated: evtSubject('sales', 'CustomerUpdated'),
    invoiceIssued: evtSubject('sales', 'InvoiceIssued'),
    invoicePaymentRecorded: evtSubject('sales', 'InvoicePaymentRecorded'),
    invoiceVoided: evtSubject('sales', 'InvoiceVoided'),
  },
  winger: {
    wingerAuthorized: evtSubject('winger', 'WingerAuthorized'),
    wingerSuspended: evtSubject('winger', 'WingerSuspended'),
  },
  media: {
    invoiceDocumentReady: evtSubject('media', 'InvoiceDocumentReady'),
    renderInvoice: rpcSubject('media', 'renderInvoice'),
  },
  notifications: {
    notificationSent: evtSubject('notifications', 'NotificationSent'),
    notificationFailed: evtSubject('notifications', 'NotificationFailed'),
  },
} as const;
