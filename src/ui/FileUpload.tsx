import { useId, useState } from 'react';
import { type DropItem, DropZone, FileTrigger, ProgressBar } from 'react-aria-components';

import { announce } from './announce';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useUiText } from './uiText';

export interface UploadFile {
  /** Stable id for the list (generated when the file is added). */
  readonly id: string;
  readonly file: File;
  /** Upload progress 0–100, set by the caller while uploading (F0.06 upload hook). */
  readonly progress?: number;
  readonly status?: 'pending' | 'uploading' | 'done' | 'error';
  /** Why the upload failed, from the server. */
  readonly error?: string;
}

export interface FileUploadProps {
  readonly label: string;
  readonly hint?: string;
  /** A form-level error (e.g. "Attach the signed muster"). */
  readonly error?: string | undefined;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  /** Accepted types as MIME types or extensions: `['application/pdf', 'image/*', '.xlsx']`. */
  readonly accept: readonly string[];
  /** Largest allowed file, in bytes. */
  readonly maxSizeBytes: number;
  readonly multiple?: boolean;
  readonly files: readonly UploadFile[];
  /** Called with the full new list when files are added or removed. */
  readonly onFilesChange: (files: UploadFile[]) => void;
  readonly className?: string;
}

const KB = 1024;
const MB = 1024 * KB;

/** "2.4 MB", "820 KB". Display only; sizes are not money, so a float is fine here. */
function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
}

function matchesType(file: File, accept: readonly string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((rule) => {
    const r = rule.toLowerCase().trim();
    if (r.startsWith('.')) return name.endsWith(r);
    if (r.endsWith('/*')) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

let counter = 0;
const newId = () => `upload-${Date.now()}-${(counter += 1)}`;

/**
 * Attach files by dropping them or choosing them. Each file is checked against the accepted types and the size
 * limit before it is added; refused files are listed with the reason and announced. Uploading itself is the
 * caller's job (it passes progress back in `files`).
 */
export function FileUpload({
  label,
  hint,
  error,
  isRequired = false,
  isDisabled = false,
  accept,
  maxSizeBytes,
  multiple = false,
  files,
  onFilesChange,
  className,
}: FileUploadProps) {
  const text = useUiText();
  const id = useId();
  const [refused, setRefused] = useState<string[]>([]);
  const rules = text.fileRules(accept.join(', '), formatBytes(maxSizeBytes), multiple);

  function addFiles(incoming: File[]) {
    const accepted: UploadFile[] = [];
    const problems: string[] = [];
    for (const file of incoming) {
      if (!matchesType(file, accept)) problems.push(text.fileTypeRefused(file.name));
      else if (file.size > maxSizeBytes) {
        problems.push(text.fileTooLarge(file.name, formatBytes(maxSizeBytes), formatBytes(file.size)));
      } else accepted.push({ id: newId(), file, status: 'pending' });
    }
    setRefused(problems);
    if (problems.length > 0) announce(problems.join(' '), 'assertive');
    if (accepted.length > 0) {
      onFilesChange(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
      announce(text.filesAdded(accepted.length));
    }
  }

  async function fromDrop(items: DropItem[]) {
    const dropped = await Promise.all(
      items.filter((item) => item.kind === 'file').map((item) => item.getFile()),
    );
    addFiles(multiple ? dropped : dropped.slice(0, 1));
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={cx('flex flex-col gap-2', className)}>
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {label}
        {isRequired ? (
          <span aria-hidden="true" className="ms-0.5 text-danger">
            *
          </span>
        ) : null}
      </span>

      <DropZone
        isDisabled={isDisabled}
        aria-label={`${label}: drop files here`}
        onDrop={(event) => {
          void fromDrop(event.items);
        }}
        className={cx(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-surface px-4 py-6 text-center',
          'data-drop-target:border-primary data-drop-target:bg-primary-subtle',
          'data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus',
          'data-disabled:opacity-50',
          error && 'border-danger',
        )}
      >
        <Icon name="upload" size="lg" className="text-fg-muted" />
        <p className="text-fg">{text.dropFilesHere}</p>
        <FileTrigger
          acceptedFileTypes={[...accept]}
          allowsMultiple={multiple}
          onSelect={(list) => {
            if (list) addFiles(Array.from(list));
          }}
        >
          <Button variant="secondary" size="sm" isDisabled={isDisabled} iconStart="file">
            {multiple ? text.chooseFiles : text.chooseFile}
          </Button>
        </FileTrigger>
        <p className="text-sm text-fg-muted">{rules}</p>
      </DropZone>

      {hint ? <p className="text-sm text-fg-muted">{hint}</p> : null}

      {refused.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-danger">
          {refused.map((problem) => (
            <li key={problem} className="flex items-start gap-1">
              <Icon name="error" size="sm" className="mt-0.5" />
              {problem}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="flex items-start gap-1 text-sm text-danger">
          <Icon name="error" size="sm" className="mt-0.5" />
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul
          aria-label={text.attachedFiles}
          className="flex flex-col divide-y divide-line rounded-md border border-line"
        >
          {files.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <Icon name="file" size="md" className="text-fg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-fg">{item.file.name}</span>
                  <span className="shrink-0 text-fg-muted figures">{formatBytes(item.file.size)}</span>
                </span>
                {item.status === 'uploading' && item.progress !== undefined ? (
                  <ProgressBar
                    value={item.progress}
                    aria-label={text.uploading(item.file.name)}
                    className="w-full"
                  >
                    {({ percentage }) => (
                      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${percentage ?? 0}%` }}
                        />
                      </span>
                    )}
                  </ProgressBar>
                ) : null}
                {item.status === 'done' ? (
                  <span className="text-sm text-success">{text.uploaded}</span>
                ) : null}
                {item.error ? <span className="text-sm text-danger">{item.error}</span> : null}
              </div>
              <IconButton
                icon="close"
                size="sm"
                label={text.remove(item.file.name)}
                isDisabled={isDisabled}
                onPress={() => {
                  onFilesChange(files.filter((f) => f.id !== item.id));
                  announce(text.fileRemoved(item.file.name));
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
