import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'destructive';
export type ButtonSize = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold select-none ' +
  'transition-[box-shadow,background-color,transform] duration-[120ms] ease-out ' +
  'disabled:opacity-55 disabled:pointer-events-none';

const byVariant: Record<ButtonVariant, string> = {
  // Primary CTA: always a solid accent-filled pill — never shadow-only.
  primary:
    'bg-accent text-accent-contrast rounded-pill shadow-elev-sm ' +
    'hover:bg-accent-hover active:shadow-elev-inset active:translate-y-px',
  // Raised neumorphic; sinks to an inset well while pressed.
  secondary:
    'bg-surface text-text-primary rounded-control shadow-elev-sm ' +
    'active:shadow-elev-inset active:translate-y-px',
  ghost:
    'bg-transparent text-text-primary rounded-control ' +
    'hover:bg-surface-sunken active:shadow-elev-inset',
  icon:
    'bg-surface text-text-primary rounded-control shadow-elev-sm aspect-square ' +
    'active:shadow-elev-inset',
  destructive:
    'bg-danger text-danger-contrast rounded-pill shadow-elev-sm ' +
    'active:shadow-elev-inset active:translate-y-px',
};

const bySize: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-caption',
  md: 'h-11 px-5 text-body',
};

const iconSizeOverride: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 p-0',
  md: 'h-11 w-11 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        base,
        byVariant[variant],
        variant === 'icon' ? iconSizeOverride[size] : bySize[size],
        className,
      )}
      {...props}
    />
  );
});
