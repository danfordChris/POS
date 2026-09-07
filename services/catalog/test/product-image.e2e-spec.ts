import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { uuidv7 } from 'uuidv7';
import {
  configureApp,
  registerNotFoundFallback,
  signInternalContext,
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
  MESSAGE_BUS,
} from '@pos/nest-common';
import { InMemoryBus } from '@pos/testing';
import { AppModule } from '../src/app.module.js';

let app: INestApplication;
let http: ReturnType<typeof request>;

const secret = process.env.INTERNAL_CONTEXT_SECRET as string;
const biz = uuidv7();

function owner() {
  const { header, signature } = signInternalContext(
    {
      request_id: `img-${uuidv7()}`,
      user_id: uuidv7(),
      business_id: biz,
      role: 'owner',
      token_kind: 'user',
    },
    secret,
  );
  return {
    [INTERNAL_CONTEXT_HEADER]: header,
    [INTERNAL_CONTEXT_SIGNATURE_HEADER]: signature,
  };
}

const imageUrl = `/v1/businesses/${biz}/products/${uuidv7()}/image`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_BUS)
    .useValue(new InMemoryBus())
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  registerNotFoundFallback(app);
  http = request(app.getHttpServer());
});

afterAll(async () => {
  await app.close();
});

describe('catalog — product image upload guards', () => {
  it('no file → a 400 validation error', async () => {
    const res = await http.post(imageUrl).set(owner()).expect(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details?.[0]).toMatchObject({
      field: 'image',
      issue: 'required',
    });
  });

  it('over 10 MB → image_too_large with the size in the message', async () => {
    const big = Buffer.alloc(11 * 1_000_000, 1); // 11 MB
    const res = await http
      .post(imageUrl)
      .set(owner())
      .attach('image', big, { filename: 'big.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body.error.code).toBe('image_too_large');
    expect(res.body.error.message).toMatch(/11\.0 MB.*under 10 MB/);
  });

  it('unsupported type → unsupported_image_type', async () => {
    const gif = Buffer.from('GIF89a');
    const res = await http
      .post(imageUrl)
      .set(owner())
      .attach('image', gif, { filename: 'x.gif', contentType: 'image/gif' })
      .expect(400);
    expect(res.body.error.code).toBe('unsupported_image_type');
    expect(res.body.error.message).toMatch(/JPEG, PNG, or WebP/);
  });
});
