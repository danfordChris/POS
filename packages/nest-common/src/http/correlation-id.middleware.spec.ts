import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { correlationId, REQUEST_ID_HEADER } from './correlation-id.middleware.js';
import type { RequestWithContext } from './request-context.js';

function run(req: Partial<RequestWithContext>): {
  line: Record<string, unknown>;
  requestId: string;
} {
  const logged: string[] = [];
  const spy = vi
    .spyOn(Logger.prototype, 'log')
    .mockImplementation((m: unknown) => void logged.push(String(m)));

  const res = Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    statusCode: 200,
  });
  const request = {
    headers: {},
    method: 'GET',
    originalUrl: '/v1/x',
    ...req,
  } as RequestWithContext;
  const next = vi.fn();

  correlationId(request, res as never, next);
  expect(next).toHaveBeenCalled();
  res.emit('finish');
  spy.mockRestore();

  return { line: JSON.parse(logged.at(-1) as string), requestId: request.requestId as string };
}

describe('correlationId middleware', () => {
  it('logs one structured line with request_id and no business_id when unscoped', () => {
    const { line, requestId } = run({});
    expect(line).toMatchObject({
      request_id: requestId,
      method: 'GET',
      path: '/v1/x',
      status: 200,
    });
    expect(typeof line.duration_ms).toBe('number');
    expect(line).not.toHaveProperty('business_id');
  });

  it('includes business_id from the resolved internal context', () => {
    const { line } = run({
      internalContext: { business_id: 'biz-7', token_kind: 'user' } as never,
    });
    expect(line.business_id).toBe('biz-7');
  });

  it('honours an inbound x-request-id', () => {
    const { line } = run({ headers: { [REQUEST_ID_HEADER]: 'inbound-123' } });
    expect(line.request_id).toBe('inbound-123');
  });
});
