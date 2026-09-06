import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { uuidv7 } from 'uuidv7';
import { configureApp, MESSAGE_BUS } from '@pos/nest-common';
import { makeEnvelope } from '@pos/contracts';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CatalogProjectionConsumer } from '../src/winger/consumers/catalog-projection.consumer.js';

let app: INestApplication;
let prisma: PrismaService;
let consumer: CatalogProjectionConsumer;

const biz = uuidv7();
const otherBiz = uuidv7();

const upserted = (
  productId: string,
  over: Partial<{
    name: string;
    image_url: string | null;
    is_active: boolean;
  }> = {},
  eventId?: string,
) =>
  makeEnvelope({
    producer: 'catalog',
    businessId: biz,
    schemaVersion: '1.2.0',
    eventId,
    payload: {
      business_id: biz,
      product_id: productId,
      sku: `SKU-${productId.slice(0, 6)}`,
      name: over.name ?? 'Sukari 1kg',
      unit: 'each',
      is_active: over.is_active ?? true,
      reorder_threshold: 0,
      ...(over.image_url !== undefined ? { image_url: over.image_url } : {}),
    },
  });

const priceChanged = (
  productId: string,
  sell: number,
  winger: number | null,
  eventId?: string,
) =>
  makeEnvelope({
    producer: 'catalog',
    businessId: biz,
    schemaVersion: '1.2.0',
    eventId,
    payload: {
      business_id: biz,
      product_id: productId,
      sell_price: sell,
      winger_price: winger,
      currency: 'TZS',
    },
  });

const stockLevel = (productId: string, onHand: number, eventId?: string) =>
  makeEnvelope({
    producer: 'inventory',
    businessId: biz,
    schemaVersion: '1.2.0',
    eventId,
    payload: { business_id: biz, product_id: productId, on_hand: onHand },
  });

const deactivated = (productId: string, eventId?: string) =>
  makeEnvelope({
    producer: 'catalog',
    businessId: biz,
    schemaVersion: '1.2.0',
    eventId,
    payload: { business_id: biz, product_id: productId },
  });

const row = (productId: string) =>
  prisma.runInTenantContext(biz, (tx) =>
    tx.wingerCatalogProjection.findUnique({
      where: { businessId_productId: { businessId: biz, productId } },
    }),
  );

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  prisma = app.get(PrismaService);
  consumer = app.get(CatalogProjectionConsumer);
});

afterAll(async () => {
  await prisma.runInTenantContext(biz, (tx) =>
    tx.wingerCatalogProjection.deleteMany({}),
  );
  await prisma.processedEvent.deleteMany({});
  await app.close();
});

describe('winger catalog projection', () => {
  it('builds a full row from ProductUpserted + PriceChanged + StockLevelChanged', async () => {
    const p = uuidv7();
    await consumer.onUpserted(
      upserted(p, {
        name: 'Mchele 2kg',
        image_url: 'https://cdn.example.com/m.jpg',
      }),
    );
    await consumer.onPriceChanged(priceChanged(p, 5000, 4500));
    await consumer.onStockLevel(stockLevel(p, 3));

    const r = await row(p);
    expect(r).toMatchObject({
      name: 'Mchele 2kg',
      imageUrl: 'https://cdn.example.com/m.jpg',
      sellPrice: 5000,
      wingerPrice: 4500,
      currency: 'TZS',
      onHand: 3,
      isActive: true,
    });
  });

  it('is idempotent on event_id — a redelivery makes no second change', async () => {
    const p = uuidv7();
    const evt = priceChanged(p, 1000, null);
    await consumer.onPriceChanged(evt);
    await consumer.onPriceChanged(evt); // same event_id
    // bump with a distinct event, then replay the first again
    await consumer.onPriceChanged(priceChanged(p, 2000, null));
    await consumer.onPriceChanged(evt);

    const r = await row(p);
    expect(r?.sellPrice).toBe(2000);
  });

  it('ProductDeactivated flips is_active to false', async () => {
    const p = uuidv7();
    await consumer.onUpserted(upserted(p));
    await consumer.onDeactivated(deactivated(p));
    expect((await row(p))?.isActive).toBe(false);
  });

  it('a null image_url on ProductUpserted clears the stored image', async () => {
    const p = uuidv7();
    await consumer.onUpserted(
      upserted(p, { image_url: 'https://cdn.example.com/x.jpg' }),
    );
    expect((await row(p))?.imageUrl).toBe('https://cdn.example.com/x.jpg');
    await consumer.onUpserted(upserted(p, { image_url: null }));
    expect((await row(p))?.imageUrl).toBeNull();
  });

  it('writes are tenant-scoped — an unscoped read sees nothing', async () => {
    const p = uuidv7();
    await consumer.onUpserted(upserted(p));
    expect(await prisma.wingerCatalogProjection.count()).toBe(0);
    const scoped = await prisma.runInTenantContext(biz, (tx) =>
      tx.wingerCatalogProjection.count(),
    );
    expect(scoped).toBeGreaterThan(0);
    // nothing leaked into another tenant
    const leak = await prisma.runInTenantContext(otherBiz, (tx) =>
      tx.wingerCatalogProjection.count(),
    );
    expect(leak).toBe(0);
  });
});
