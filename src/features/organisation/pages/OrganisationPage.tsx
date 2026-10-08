import { useState } from 'react';
import { z } from 'zod';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Card, Input, PageHeader, Select, Stack, toast } from '@/ui';

import { type Organisation, PHONE } from '../api/schemas';
import { useOrganisation, useUpdateOrganisation } from '../api/hierarchy';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Organisation settings (P1.07): the one company the estates belong to. */
export function OrganisationPage() {
  const query = useOrganisation();
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version: after a save or a conflict reload the form shows what is stored.
  return <OrganisationForm key={query.data.version} organisation={query.data} />;
}

function OrganisationForm({ organisation }: { readonly organisation: Organisation }) {
  const { t } = useTranslation('org');
  const canEdit = usePermission('organisation.edit');
  const update = useUpdateOrganisation(organisation);
  const [refusal, setRefusal] = useState<unknown>(null);

  const required = (field: string) => t('validation.required', { field: field.toLowerCase() });
  const optional = (max: number) => z.string().trim().max(max);
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, required(t('organisation.name')))
      .max(150),
    short_name: z
      .string()
      .trim()
      .min(1, required(t('organisation.shortName')))
      .max(50),
    registration_number: optional(50),
    tin: optional(30),
    vat_registration: optional(30),
    address_line1: optional(200),
    address_line2: optional(200),
    city: optional(100),
    postal_code: optional(20),
    phone: z.union([z.literal(''), z.string().trim().regex(PHONE, t('validation.phone'))]),
    email: z.union([z.literal(''), z.email(t('validation.email')).max(150)]),
    website: optional(150),
    fiscal_year_start_month: z.string(),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      name: organisation.name,
      short_name: organisation.short_name,
      registration_number: organisation.registration_number ?? '',
      tin: organisation.tin ?? '',
      vat_registration: organisation.vat_registration ?? '',
      address_line1: organisation.address_line1 ?? '',
      address_line2: organisation.address_line2 ?? '',
      city: organisation.city ?? '',
      postal_code: organisation.postal_code ?? '',
      phone: organisation.phone ?? '',
      email: organisation.email ?? '',
      website: organisation.website ?? '',
      fiscal_year_start_month: String(organisation.fiscal_year_start_month),
    },
  });
  // One binding per field, in a fixed order (hooks); every input is read-only without organisation.edit.
  const bind = {
    name: useFormField(form.control, 'name'),
    short_name: useFormField(form.control, 'short_name'),
    registration_number: useFormField(form.control, 'registration_number'),
    tin: useFormField(form.control, 'tin'),
    vat_registration: useFormField(form.control, 'vat_registration'),
    address_line1: useFormField(form.control, 'address_line1'),
    address_line2: useFormField(form.control, 'address_line2'),
    city: useFormField(form.control, 'city'),
    postal_code: useFormField(form.control, 'postal_code'),
    phone: useFormField(form.control, 'phone'),
    email: useFormField(form.control, 'email'),
    website: useFormField(form.control, 'website'),
  };
  const field = (name: keyof typeof bind) => ({ ...bind[name], isReadOnly: !canEdit });

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        name: values.name.trim(),
        short_name: values.short_name.trim(),
        registration_number: blankToNull(values.registration_number),
        tin: blankToNull(values.tin),
        vat_registration: blankToNull(values.vat_registration),
        address_line1: blankToNull(values.address_line1),
        address_line2: blankToNull(values.address_line2),
        city: blankToNull(values.city),
        postal_code: blankToNull(values.postal_code),
        phone: blankToNull(values.phone),
        email: blankToNull(values.email),
        website: blankToNull(values.website),
        fiscal_year_start_month: Number.parseInt(values.fiscal_year_start_month, 10),
      });
      toast.success(t('organisation.saved'));
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') return;
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      setRefusal(error);
    }
  });

  const fiscal = useFormField(form.control, 'fiscal_year_start_month');

  return (
    <Stack gap={6}>
      <PageHeader title={t('organisation.title')} description={t('organisation.description')} />
      {!canEdit ? <PermissionNotice /> : null}
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Card title={t('organisation.identity')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label={t('organisation.name')} isRequired autoComplete="organization" {...field('name')} />
            <Input
              label={t('organisation.shortName')}
              hint={t('organisation.shortNameHint')}
              isRequired
              {...field('short_name')}
            />
            <Input label={t('organisation.registrationNumber')} {...field('registration_number')} />
            <Input label={t('organisation.tin')} {...field('tin')} />
            <Input label={t('organisation.vat')} {...field('vat_registration')} />
          </div>
        </Card>
        <Card title={t('organisation.address')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('organisation.addressLine1')}
              autoComplete="address-line1"
              {...field('address_line1')}
            />
            <Input
              label={t('organisation.addressLine2')}
              autoComplete="address-line2"
              {...field('address_line2')}
            />
            <Input label={t('organisation.city')} autoComplete="address-level2" {...field('city')} />
            <Input
              label={t('organisation.postalCode')}
              autoComplete="postal-code"
              {...field('postal_code')}
            />
          </div>
        </Card>
        <Card title={t('organisation.contact')} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input label={t('organisation.phone')} type="tel" {...field('phone')} />
            <Input label={t('organisation.email')} type="email" {...field('email')} />
            <Input label={t('organisation.website')} type="url" {...field('website')} />
          </div>
        </Card>
        <Card title={t('organisation.finance')} headingLevel={2}>
          <Select
            label={t('organisation.fiscalYearStart')}
            hint={t('organisation.fiscalYearStartHint')}
            className="md:w-64"
            isDisabled={!canEdit}
            value={fiscal.value}
            onChange={(value) => {
              if (value) fiscal.onChange(value);
            }}
            options={MONTHS.map((month) => ({
              id: String(month),
              label: t(`months.m${String(month)}` as 'months.m1'),
            }))}
          />
        </Card>
        <Alert tone="info">{t('organisation.later')}</Alert>
        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" isPending={update.isPending} className="w-full sm:w-auto">
              {t('actions.save')}
            </Button>
          </div>
        ) : null}
      </form>
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { OrganisationPage as Component };
