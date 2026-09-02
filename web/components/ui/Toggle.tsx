import { cn } from './cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

/** Inset-track switch; the knob slides and raises. */
export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill px-0.5',
        'bg-surface-sunken shadow-elev-inset transition-colors duration-[120ms]',
        checked && 'bg-accent',
        disabled && 'opacity-55 pointer-events-none',
      )}
    >
      <span
        className={cn(
          'h-6 w-6 rounded-pill bg-surface shadow-elev-sm',
          'transition-transform duration-[120ms] ease-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
