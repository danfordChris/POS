import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Leading adornment (icon, currency symbol). */
  leading?: ReactNode;
}

/** Inset-well text input — recessed on the sunken surface. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, leading, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={inputId} className="text-caption font-semibold text-text-secondary">
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          'flex items-center gap-2 rounded-control bg-surface-sunken px-3.5',
          'shadow-elev-inset',
          error ? 'ring-1 ring-danger' : null,
        )}
      >
        {leading ? <span className="text-text-secondary shrink-0">{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full bg-transparent text-body text-text-primary',
            'placeholder:text-text-disabled outline-none',
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-err`} className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-caption text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
