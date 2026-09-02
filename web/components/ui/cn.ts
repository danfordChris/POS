/** Minimal class-name joiner — falsy entries dropped, no dedupe. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
