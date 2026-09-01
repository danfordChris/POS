import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

beforeAll(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => vi.restoreAllMocks());

interface CapturedResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function mockHost(requestId = 'req-1'): { host: ArgumentsHost; res: CapturedResponse } {
  const res: CapturedResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const req = { requestId, method: 'POST', originalUrl: '/v1/things' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('validation error: friendly message + technical devMessage + per-field details', () => {
    const { host, res } = mockHost();
    filter.catch(
      new BadRequestException(['email must be an email', 'name should not be empty']),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('validation_error');
    expect(body.error.message).toBe('Please check the information you entered.');
    expect(body.error.devMessage).toBe('email must be an email; name should not be empty');
    expect(body.error.details).toEqual([
      { field: 'email', issue: 'email must be an email' },
      { field: 'name', issue: 'name should not be empty' },
    ]);
    expect(body.requestId).toBe('req-1');
  });

  it('maps a NotFoundException: friendly message, raw text as devMessage', () => {
    const { host, res } = mockHost();
    filter.catch(new NotFoundException('thing missing'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toMatchObject({
      code: 'not_found',
      message: 'We could not find what you were looking for.',
      devMessage: 'thing missing',
      details: [],
    });
  });

  it('honours an explicit userMessage on the thrown exception', () => {
    const { host, res } = mockHost();
    filter.catch(
      new NotFoundException({
        code: 'not_found',
        message: 'business 123 missing',
        userMessage: 'That shop no longer exists.',
      }),
      host,
    );
    expect(res.json.mock.calls[0][0].error).toMatchObject({
      message: 'That shop no longer exists.',
      devMessage: 'business 123 missing',
    });
  });

  it('unknown error → 500 internal_error, no leak in either field', () => {
    const { host, res } = mockHost('req-2');
    filter.catch(new Error('boom: secret internals'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('internal_error');
    expect(body.error.message).toBe('Something went wrong on our side. Please try again.');
    expect(body.error.devMessage).toContain('req-2');
    expect(JSON.stringify(body)).not.toContain('secret internals');
  });
});
