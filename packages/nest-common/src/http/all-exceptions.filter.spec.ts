import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

beforeAll(() => {
  // The filter logs 5xx errors by design; keep that noise out of the test report.
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

interface CapturedResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function mockHost(requestId = 'req-1'): {
  host: ArgumentsHost;
  res: CapturedResponse;
} {
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

  it('maps a class-validator BadRequestException to validation_error with details', () => {
    const { host, res } = mockHost();

    filter.catch(
      new BadRequestException(['email must be an email', 'name should not be empty']),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('validation_error');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toEqual([
      { field: 'email', issue: 'email must be an email' },
      { field: 'name', issue: 'name should not be empty' },
    ]);
    expect(body.requestId).toBe('req-1');
  });

  it('maps a NotFoundException to not_found with an empty details array', () => {
    const { host, res } = mockHost();

    filter.catch(new NotFoundException('thing missing'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toMatchObject({
      code: 'not_found',
      message: 'thing missing',
      details: [],
    });
  });

  it('maps an unknown error to internal_error 500 without leaking the message', () => {
    const { host, res } = mockHost('req-2');

    filter.catch(new Error('boom: secret internals'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      error: {
        code: 'internal_error',
        message: 'Internal server error',
        details: [],
      },
      requestId: 'req-2',
    });
  });
});
