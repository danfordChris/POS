/** Where an unhandled (5xx) error is reported, beyond the HTTP response + log. */
export interface ErrorContext {
  requestId: string;
  method?: string;
  path?: string;
  /** From the signed internal context, when the request carried one. */
  businessId?: string | null;
}

export interface ErrorReporter {
  /** Called once per unhandled server error. Must not throw. */
  captureException(error: unknown, context: ErrorContext): void;
}

/** Default: does nothing. The HTTP response and the error log are unchanged. */
export const noopErrorReporter: ErrorReporter = {
  captureException(): void {
    /* no-op */
  },
};

/**
 * Adapter shape for a real error-tracking client. A host wires its own client
 * (Sentry, GlitchTip, …) and passes it to `configureApp({ errorReporter })`:
 *
 * ```ts
 * const reporter: ErrorReporter = {
 *   captureException(err, ctx) {
 *     Sentry.captureException(err, { tags: { request_id: ctx.requestId, business_id: ctx.businessId ?? 'none' } });
 *   },
 * };
 * configureApp(app, { errorReporter: reporter });
 * ```
 */
export type { ErrorReporter as ErrorReporterAdapter };
