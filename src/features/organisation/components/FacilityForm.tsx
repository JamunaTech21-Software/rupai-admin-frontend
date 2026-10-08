import { type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { Button, Card, PageHeader, Stack } from '@/ui';

import { type NodePath } from '../api/hierarchy';
import { type NodeStatus } from '../api/schemas';

import { NodeLifecycle } from './NodeLifecycle';

/**
 * The frame of a factory, warehouse or party page: header with status and lifecycle actions, the details form,
 * Save, and whatever comes after it (the contacts panel). The page supplies the fields and the submit.
 */
export function FacilityForm({
  path,
  record,
  title,
  newIntro,
  backLabel,
  editPermission,
  createPermission,
  deletePermission,
  detailsTitle,
  submitLabel,
  isPending,
  onSubmit,
  children,
  after,
  refusal,
  onRefused,
}: {
  readonly path: Extract<NodePath, 'factories' | 'warehouses' | 'parties'>;
  readonly record: { id: string; version: number; status: NodeStatus; code: string; name: string } | null;
  readonly title: string;
  readonly newIntro: string;
  readonly backLabel: string;
  readonly editPermission: string;
  readonly createPermission: string;
  readonly deletePermission: string;
  readonly detailsTitle: string;
  readonly submitLabel: string;
  readonly isPending: boolean;
  readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  /** The form fields. */
  readonly children: ReactNode;
  /** Shown after the form, for an existing record only (e.g. the contacts panel). */
  readonly after?: ReactNode;
  readonly refusal: unknown;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const canEdit = usePermission(record ? editPermission : createPermission);
  const canEditExisting = usePermission(editPermission);
  const canDelete = usePermission(deletePermission);
  const name = record?.name ?? '';

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        {...(record
          ? {
              status: {
                tone: record.status === 'active' ? 'success' : 'neutral',
                label: t(`status.${record.status}`),
              } as const,
            }
          : {})}
        description={record ? record.code : newIntro}
        breadcrumbs={[{ label: backLabel, href: `/${path}` }, { label: title }]}
        actions={
          record ? (
            <NodeLifecycle
              path={path}
              node={record}
              subject={record.name}
              text={{
                deactivateTitle: t('facility.deactivateTitle', { name }),
                deactivateBody: t('facility.deactivateBody'),
                reactivateTitle: t('facility.reactivateTitle', { name }),
                reactivateBody: t('facility.reactivateBody'),
                deleteTitle: t('facility.deleteTitle', { name }),
                deleteBody: t('facility.deleteBody'),
                deactivated: t('facility.deactivated', { name }),
                reactivated: t('facility.reactivated', { name }),
                deleted: t('facility.deleted', { name }),
              }}
              canEdit={canEditExisting}
              canDelete={canDelete}
              onDeleted={() => {
                void navigate(`/${path}`, { replace: true });
              }}
              onRefused={onRefused}
            />
          ) : undefined
        }
      />
      {!canEdit ? <PermissionNotice /> : null}
      <form noValidate className="flex flex-col gap-6" onSubmit={onSubmit}>
        <Card title={detailsTitle} headingLevel={2}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
        </Card>
        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" isPending={isPending} className="w-full sm:w-auto">
              {submitLabel}
            </Button>
          </div>
        ) : null}
      </form>
      {record ? after : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          onRefused(null);
        }}
      />
    </Stack>
  );
}
