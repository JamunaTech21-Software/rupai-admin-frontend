import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { lookupText, useActiveLookups } from '@/lib/lookups';
import { Alert, Button, DatePicker, FileUpload, Input, Modal, Select, toast, type UploadFile } from '@/ui';

import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  type DocumentOwner,
  type DocumentRecord,
  useReplaceDocument,
  useUpdateDocument,
  useUploadDocument,
} from '../api/documents';

export type DocumentForm =
  | { readonly kind: 'add' }
  | { readonly kind: 'replace'; readonly doc: DocumentRecord }
  | { readonly kind: 'edit'; readonly doc: DocumentRecord };

type Field = 'type' | 'title' | 'issue_date' | 'expiry_date' | 'file';
type Errors = Partial<Record<Field, string>>;

/** The errors without one field (the user is fixing it). */
const without = (errors: Errors, field: Field): Errors =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field));

const STUB = { id: '', version: 0, title: null, file_name: '' } as const;

/** The server names its fields as the API does; the form keeps them under these. */
const FIELD_OF: Readonly<Record<string, Field>> = {
  document_type_id: 'type',
  title: 'title',
  issue_date: 'issue_date',
  expiry_date: 'expiry_date',
  file: 'file',
};

/**
 * Add a document, replace one with a new file, or correct a document's title and dates. A replacement keeps what
 * is left empty (the old file stays as an earlier version). The server's message for a refused file (wrong type,
 * empty, the same file again) is shown on the file; a too-large file is refused in a dialog with the limit.
 */
export function DocumentFormModal({
  form,
  owner,
  excludeTypes,
  onClose,
  onRefused,
}: {
  readonly form: DocumentForm;
  readonly owner: DocumentOwner;
  /** Document types the owner manages elsewhere (an estate's photographs): not offered here. */
  readonly excludeTypes: readonly string[];
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('docs');
  const doc = form.kind === 'add' ? null : form.doc;
  const types = useActiveLookups('document_type', form.kind === 'add');
  const upload = useUploadDocument(owner);
  const replace = useReplaceDocument(form.kind === 'replace' ? form.doc : STUB);
  const update = useUpdateDocument(form.kind === 'edit' ? form.doc : STUB);

  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState(form.kind === 'edit' ? (form.doc.title ?? '') : '');
  const [issueDate, setIssueDate] = useState<string | null>(
    form.kind === 'edit' ? form.doc.issue_date : null,
  );
  const [expiryDate, setExpiryDate] = useState<string | null>(
    form.kind === 'edit' ? form.doc.expiry_date : null,
  );
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  const typeOptions = (types.data ?? [])
    .filter((row) => !excludeTypes.includes(lookupText(row, 'code')))
    .map((row) => ({ id: row.id, label: lookupText(row, 'name') || lookupText(row, 'code') }));
  const name = doc ? (doc.title ?? doc.document_type.name) : '';
  const isPending = upload.isPending || replace.isPending || update.isPending;

  function check(): Errors {
    const found: Errors = {};
    if (form.kind === 'add' && typeId === '') found.type = t('form.typeRequired');
    if (form.kind !== 'edit' && files.length === 0) found.file = t('form.fileRequired');
    if (issueDate && expiryDate && expiryDate < issueDate) found.expiry_date = t('form.expiryBeforeIssue');
    return found;
  }

  async function submit() {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const details = { title: title.trim(), issueDate, expiryDate };
    const file = files[0]?.file;
    try {
      if (form.kind === 'add' && file) {
        await upload.mutateAsync({ file, documentTypeId: typeId, ...details });
        toast.success(t('form.added'));
      } else if (form.kind === 'replace' && file) {
        const saved = await replace.mutateAsync({ file, ...details });
        toast.success(t('form.replaced', { number: saved.version_number }));
      } else if (form.kind === 'edit') {
        await update.mutateAsync(details);
        toast.success(t('form.saved'));
      }
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        const placed: Errors = {};
        let rest = false;
        for (const detail of error.fieldErrors) {
          const field = detail.field ? FIELD_OF[detail.field] : undefined;
          if (field) placed[field] = detail.message;
          else rest = true;
        }
        if (Object.keys(placed).length > 0) {
          setErrors(placed);
          if (!rest) return;
        }
      }
      onRefused(error);
    }
  }

  const title_ =
    form.kind === 'add'
      ? t('form.addTitle')
      : form.kind === 'replace'
        ? t('form.replaceTitle', { name })
        : t('form.editTitle', { name });

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title_}
      {...(form.kind === 'replace' ? { description: t('form.replaceNote') } : {})}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('form.cancel')}
          </Button>
          <Button
            isPending={isPending}
            onPress={() => {
              void submit();
            }}
          >
            {form.kind === 'add'
              ? t('form.add')
              : form.kind === 'replace'
                ? t('form.replace')
                : t('form.save')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {form.kind === 'add' ? (
          typeOptions.length === 0 && !types.isPending ? (
            <Alert tone="warning" className="sm:col-span-2">
              {t('form.noTypes')}
            </Alert>
          ) : (
            <Select
              label={t('form.type')}
              isRequired
              className="sm:col-span-2"
              value={typeId === '' ? null : typeId}
              options={typeOptions}
              onChange={(value) => {
                setTypeId(value ?? '');
                setErrors((current) => without(current, 'type'));
              }}
              {...(errors.type ? { error: errors.type } : {})}
            />
          )
        ) : null}
        <Input
          label={t('form.title')}
          hint={t('form.titleHint')}
          className="sm:col-span-2"
          autoComplete="off"
          maxLength={150}
          value={title}
          onChange={setTitle}
          {...(errors.title ? { error: errors.title } : {})}
        />
        <DatePicker
          label={t('form.issueDate')}
          value={issueDate}
          onChange={setIssueDate}
          {...(errors.issue_date ? { error: errors.issue_date } : {})}
        />
        <DatePicker
          label={t('form.expiryDate')}
          value={expiryDate}
          onChange={setExpiryDate}
          {...(errors.expiry_date ? { error: errors.expiry_date } : {})}
        />
        {form.kind !== 'edit' ? (
          <div className="sm:col-span-2">
            <FileUpload
              label={t('form.file')}
              isRequired
              accept={DOCUMENT_ACCEPT}
              maxSizeBytes={DOCUMENT_MAX_BYTES}
              files={files}
              onFilesChange={(next) => {
                setFiles(next.slice(-1));
                setErrors((current) => without(current, 'file'));
              }}
              {...(errors.file ? { error: errors.file } : {})}
            />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
