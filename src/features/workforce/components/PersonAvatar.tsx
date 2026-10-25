import { Avatar } from '@/ui';

import { usePhotoLink } from '../api/profiles';

/** A person's photograph (their latest photograph document), or their initials until there is one. */
export function PersonAvatar({
  name,
  photoDocumentId,
  size = 'md',
}: {
  readonly name: string;
  readonly photoDocumentId: string | null;
  readonly size?: 'sm' | 'md' | 'lg';
}) {
  const link = usePhotoLink(photoDocumentId);
  return <Avatar name={name} decorative size={size} {...(link.data ? { src: link.data } : {})} />;
}
