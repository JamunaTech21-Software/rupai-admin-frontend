import { useState } from 'react';
import { z } from 'zod';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import {
  Badge,
  type BadgeTone,
  Button,
  ConfirmDialog,
  DatePicker,
  Modal,
  Select,
  Textarea,
  toast,
} from '@/ui';

import { useDeleteProfile, useSeparate, useSuspension } from '../api/profiles';
import { type Profile, SEPARATION_TYPES } from '../api/profileSchemas';

const todayIso = () => new Date().toISOString().slice(0, 10);
const TONES: Record<Profile['status'], BadgeTone> = {
  active: 'success',
  on_leave: 'warning',
  suspended: 'warning',
  separated: 'neutral',
};

/** Active / On leave / Suspended / Separated. */
export function ProfileStatusBadge({ status }: { readonly status: Profile['status'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[status]} label={t(`profileStatus.${status}`)} />;
}

/** Suspend or reinstate: the reason is asked for and kept with the profile (employment.edit). */
function SuspensionDialog({
  profile,
  action,
  onClose,
  onRefused,
}: {
  readonly profile: Profile;
  readonly action: 'suspend' | 'reinstate';
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const change = useSuspension(profile);
  const schema = z.object({ reason: z.string().trim().min(3, t('validation.reason')).max(500) });
  const form = useZodForm(schema, { defaultValues: { reason: '' } });
  const reason = useFormField(form.control, 'reason');
  const name = profile.person.full_name;

  const submit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync({ action, reason: values.reason.trim() });
      toast.success(t(action === 'suspend' ? 'actions.suspended' : 'actions.reinstated', { name }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
      onClose();
    }
  });

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(action === 'suspend' ? 'actions.suspendTitle' : 'actions.reinstateTitle', { name })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={change.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t(action === 'suspend' ? 'actions.suspend' : 'actions.reinstate')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Textarea
          label={t('actions.reason')}
          placeholder={t('actions.reasonPlaceholder')}
          rows={3}
          maxLength={500}
          isRequired
          {...reason}
        />
      </form>
    </Modal>
  );
}

/** End the employment: the date, the kind and the reason (employment.approve). The profile then cannot be changed. */
function SeparationDialog({
  profile,
  onClose,
  onRefused,
}: {
  readonly profile: Profile;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const separate = useSeparate(profile);
  const schema = z.object({
    separation_date: z
      .string()
      .min(1, t('validation.separationDate'))
      .refine((v) => v >= profile.joining_date, t('validation.beforeJoining')),
    separation_type: z
      .enum(SEPARATION_TYPES)
      .nullable()
      .refine((v) => v !== null, t('validation.separationType')),
    reason: z.string().trim().min(3, t('validation.reason')).max(500),
  });
  const form = useZodForm(schema, {
    defaultValues: { separation_date: todayIso(), separation_type: null, reason: '' },
  });
  const bind = {
    separation_date: useFormField(form.control, 'separation_date'),
    separation_type: useFormField(form.control, 'separation_type'),
    reason: useFormField(form.control, 'reason'),
  };
  const name = profile.person.full_name;

  const submit = form.handleSubmit(async (values) => {
    try {
      await separate.mutateAsync({
        separation_date: values.separation_date,
        separation_type: values.separation_type,
        reason: values.reason.trim(),
      });
      toast.success(t('actions.separated', { name }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
      onClose();
    }
  });

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('actions.separateTitle', { name })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="danger"
            isPending={separate.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('actions.separate')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <p className="text-sm text-fg-muted sm:col-span-2">{t('actions.separateWarning')}</p>
        <DatePicker
          label={t('actions.separationDate')}
          isRequired
          value={bind.separation_date.value || null}
          onChange={(next) => {
            bind.separation_date.onChange(next ?? '');
          }}
          {...(bind.separation_date.error ? { error: bind.separation_date.error } : {})}
        />
        <Select
          label={t('actions.separationType')}
          placeholder={t('form.select')}
          isRequired
          value={bind.separation_type.value}
          options={SEPARATION_TYPES.map((type) => ({ id: type, label: t(`separationTypes.${type}`) }))}
          onChange={(next) => {
            bind.separation_type.onChange(SEPARATION_TYPES.find((type) => type === next) ?? null);
          }}
          {...(bind.separation_type.error ? { error: bind.separation_type.error } : {})}
        />
        <Textarea
          label={t('actions.reason')}
          placeholder={t('actions.reasonPlaceholder')}
          rows={3}
          maxLength={500}
          isRequired
          className="sm:col-span-2"
          {...bind.reason}
        />
      </form>
    </Modal>
  );
}

/**
 * What can be done to a profile, each only for those who may: suspend or reinstate (employment.edit), separate
 * (employment.approve) and delete (employment.delete). A separated profile can only be looked at.
 */
export function ProfileActions({
  profile,
  canEdit,
  canApprove,
  canDelete,
  onDeleted,
  onRefused,
}: {
  readonly profile: Profile;
  readonly canEdit: boolean;
  readonly canApprove: boolean;
  readonly canDelete: boolean;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const remove = useDeleteProfile(profile);
  const [asking, setAsking] = useState<'suspend' | 'reinstate' | 'separate' | 'delete' | null>(null);
  const separated = profile.status === 'separated';
  const name = profile.person.full_name;
  const close = () => {
    setAsking(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && !separated ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking(profile.status === 'suspended' ? 'reinstate' : 'suspend');
          }}
        >
          {t(profile.status === 'suspended' ? 'actions.reinstate' : 'actions.suspend')}
        </Button>
      ) : null}
      {canApprove && !separated ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking('separate');
          }}
        >
          {t('actions.separate')}
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('actions.delete')}
        </Button>
      ) : null}
      {asking === 'suspend' || asking === 'reinstate' ? (
        <SuspensionDialog profile={profile} action={asking} onClose={close} onRefused={onRefused} />
      ) : null}
      {asking === 'separate' ? (
        <SeparationDialog profile={profile} onClose={close} onRefused={onRefused} />
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t('actions.deleteTitle', { name })}
        consequence={t('actions.deleteBody')}
        confirmLabel={t('actions.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('actions.deleted', { name }));
            onDeleted();
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          close();
        }}
      />
    </div>
  );
}
