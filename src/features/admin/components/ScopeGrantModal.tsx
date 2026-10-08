import { z } from 'zod';

import { todayIn } from '@/lib/dates';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, DatePicker, Input, Modal, Select, toast } from '@/ui';

import { GRANTABLE_SCOPE_TYPES, type GrantableScopeType, type User } from '../api/schemas';
import { useGrantScope } from '../api/scopes';
import { endOfDhakaDay } from '../labels';

export interface ScopeGrantModalProps {
  readonly user: User;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}

const RECORD_ID = /^[1-9]\d{0,17}$/;

/**
 * Grant a data scope: all estates, or one estate, division, section, department, factory or warehouse. Until estate
 * set-up (P1.07) gives those records names, the target is typed as its number.
 */
export function ScopeGrantModal({ user, isOpen, onClose, onRefused }: ScopeGrantModalProps) {
  const { t } = useTranslation('admin');
  const grant = useGrantScope(user);
  const schema = z
    .object({
      scope_type: z.enum(GRANTABLE_SCOPE_TYPES, t('validation.scopeType')),
      scope_id: z.string().trim(),
      expires_at: z.string().nullable(),
    })
    .superRefine((values, ctx) => {
      if (values.scope_type !== 'all_estates' && !RECORD_ID.test(values.scope_id)) {
        ctx.addIssue({ code: 'custom', path: ['scope_id'], message: t('validation.scopeId') });
      }
    });
  const form = useZodForm(schema, {
    defaultValues: { scope_type: 'estate' as GrantableScopeType, scope_id: '', expires_at: null },
  });
  const typeField = useFormField(form.control, 'scope_type');
  const targetField = useFormField(form.control, 'scope_id');
  const expiryField = useFormField(form.control, 'expires_at');
  const scopeType = form.watch('scope_type');
  const targeted = scopeType !== 'all_estates';

  const submit = form.handleSubmit(async (values) => {
    try {
      await grant.mutateAsync({
        scope_type: values.scope_type,
        ...(values.scope_type === 'all_estates' ? {} : { scope_id: values.scope_id }),
        expires_at: values.expires_at ? endOfDhakaDay(values.expires_at) : null,
      });
      toast.success(t('scope.granted'));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        // all_estates has no target field, so a duplicate is shown on the type instead.
        const details = error.fieldErrors.map((detail) =>
          detail.field === 'scope_id' && !targeted ? { ...detail, field: 'scope_type' } : detail,
        );
        if (applyServerErrors(form, details).length === 0) return;
      }
      onRefused(error);
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('scope.grantTitle', { username: user.username })}
      description={t('scope.grantHint')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('ui:cancel')}
          </Button>
          <Button
            isPending={grant.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('scope.grant')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Select
          label={t('scope.type')}
          isRequired
          options={GRANTABLE_SCOPE_TYPES.map((type) => ({
            id: type,
            label: t(`scope.types.${type}`),
            description: t(`scope.typeHints.${type}`),
          }))}
          {...typeField}
          // The options are exactly the grantable types.
          onChange={(value) => {
            typeField.onChange(value as GrantableScopeType);
          }}
        />
        {targeted ? (
          <Input
            label={t('scope.target', { type: t(`scope.types.${scopeType}`) })}
            hint={t('scope.targetHint')}
            isRequired
            inputMode="numeric"
            autoComplete="off"
            {...targetField}
          />
        ) : null}
        <DatePicker
          label={t('scope.expires')}
          hint={t('scope.expiresHint')}
          minValue={todayIn()}
          {...expiryField}
        />
      </form>
    </Modal>
  );
}
