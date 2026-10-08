import { useState } from 'react';

import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Modal, Textarea } from '@/ui';

import { type GivenAuthorisation, type NeededAuthorisation } from '../api/access';

import { KindBadge, PermissionChips } from './SodParts';

const MIN_REASON = 10;

export interface AuthorisationDialogProps {
  readonly isOpen: boolean;
  /** What needs a named authorisation; one reason box each. */
  readonly needed: readonly NeededAuthorisation[];
  /** One sentence on what is being saved ("Saving the roles of rahim …"). */
  readonly intro: string;
  readonly isPending: boolean;
  /** Server-side reason errors (VALIDATION_FAILED on authorisations.N.reason), by needed index. */
  readonly serverErrors?: Readonly<Record<number, string>>;
  readonly onCancel: () => void;
  readonly onConfirm: (given: GivenAuthorisation[]) => void;
}

/**
 * The separation-of-duties dialog (P6 Fig 9.1). A conflict or a sensitive permission does not block the change:
 * it needs a named authorisation with a written reason, recorded with who gave it and when, and listed on the
 * access review. Each item shows what it is, why it matters, the permissions involved and a reason box.
 */
export function AuthorisationDialog({
  isOpen,
  needed,
  intro,
  isPending,
  serverErrors = {},
  onCancel,
  onConfirm,
}: AuthorisationDialogProps) {
  const { t } = useTranslation('admin');
  const [reasons, setReasons] = useState<string[]>(() => needed.map(() => ''));
  const [submitted, setSubmitted] = useState(false);

  const errorFor = (index: number): string | undefined => {
    const server = serverErrors[index];
    if (server) return server;
    if (submitted && (reasons[index] ?? '').trim().length < MIN_REASON) return t('sod.reasonTooShort');
    return undefined;
  };

  function confirm() {
    setSubmitted(true);
    if (reasons.some((reason) => reason.trim().length < MIN_REASON)) return;
    onConfirm(
      needed.map((item, index) => ({
        key: item.key,
        reason: (reasons[index] ?? '').trim(),
        ...(item.userId ? { user_id: item.userId } : {}),
      })),
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      size="lg"
      title={t('sod.dialogTitle', { count: needed.length })}
      description={intro}
      footer={
        <>
          <Button variant="secondary" onPress={onCancel}>
            {t('sod.cancel')}
          </Button>
          <Button variant="danger" iconStart="shield" isPending={isPending} onPress={confirm}>
            {t('sod.authoriseAndSave')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning">{t('sod.dialogNotice')}</Alert>
        <ol className="flex flex-col gap-4">
          {needed.map((item, index) => (
            <li
              key={`${item.userId ?? ''}:${item.key}`}
              className="flex flex-col gap-3 rounded-lg border border-line p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge kind={item.kind} />
                <span className="text-sm text-fg-muted">{item.rule}</span>
                {item.username ? (
                  <span className="text-sm font-medium text-fg">
                    {t('sod.forUser', { username: item.username })}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-medium text-fg">{item.title}</p>
                {item.why ? <p className="text-sm text-fg-muted">{item.why}</p> : null}
              </div>
              <PermissionChips permissions={item.permissions} label={t('sod.permissionsInvolved')} />
              <Textarea
                label={t('sod.reason')}
                hint={t('sod.reasonHint')}
                isRequired
                rows={2}
                maxLength={1000}
                value={reasons[index] ?? ''}
                {...(errorFor(index) ? { error: errorFor(index) } : {})}
                onChange={(value) => {
                  setReasons((current) => current.map((reason, i) => (i === index ? value : reason)));
                }}
              />
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
