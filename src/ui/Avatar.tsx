import { useState } from 'react';

import { cx } from './cx';
import { initialsOf } from './initials';

const SIZE = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' } as const;

export interface AvatarProps {
  /** The person's name: used for the initials, and as the accessible name unless `decorative`. */
  readonly name: string;
  /** Photo URL. If it is missing or fails to load, the initials show instead. */
  readonly src?: string;
  readonly size?: keyof typeof SIZE;
  /** Set when the name is already written next to the avatar, so it is not read twice. */
  readonly decorative?: boolean;
  readonly className?: string;
}

/** A person's photo, falling back to their initials. */
export function Avatar({ name, src, size = 'md', decorative = false, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  // An avatar is never an unnamed image: with no name yet it is announced as such.
  const accessibleName = name.trim() === '' ? 'Unnamed person' : name;
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': accessibleName };

  return (
    <span
      {...a11y}
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-subtle font-semibold text-primary-strong',
        SIZE[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name) || '?'}</span>
      )}
    </span>
  );
}
