type ClassValue = string | false | null | undefined;

/** Joins class names, skipping falsy values: `cx('a', isOn && 'b')`. */
export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
