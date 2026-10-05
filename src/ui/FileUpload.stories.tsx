import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { FileUpload, type UploadFile } from './FileUpload';

const meta = {
  title: 'Forms/FileUpload',
  parameters: {
    docs: {
      description: {
        component: [
          'Attach files by dropping or choosing them.',
          '',
          '**Usage rules**',
          '- Always set `accept` (MIME types or extensions) and `maxSizeBytes`; both are shown to the user.',
          '- Refused files are listed with the reason and announced; accepted ones join `files`.',
          '- The caller uploads and sets `status` / `progress` / `error` on each file (the F0.06 upload hook).',
          '- Each file has a remove button named after the file.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: function Render() {
    const [files, setFiles] = useState<UploadFile[]>([]);
    return (
      <div className="max-w-lg">
        <FileUpload
          label="Signed muster sheet"
          accept={['application/pdf', 'image/*']}
          maxSizeBytes={5 * 1024 * 1024}
          files={files}
          onFilesChange={setFiles}
          isRequired
        />
      </div>
    );
  },
};

export const UploadingAndErrors: Story = {
  render: function Render() {
    const sample = (name: string, size: number, type: string) =>
      new File([new Uint8Array(size)], name, { type });
    const [files, setFiles] = useState<UploadFile[]>([
      {
        id: 'a',
        file: sample('muster-2026-10-04.pdf', 820_000, 'application/pdf'),
        status: 'uploading',
        progress: 62,
      },
      { id: 'b', file: sample('weighbridge.jpg', 2_400_000, 'image/jpeg'), status: 'done', progress: 100 },
      {
        id: 'c',
        file: sample('leave-form.pdf', 120_000, 'application/pdf'),
        status: 'error',
        error: 'The server refused this file: it is password-protected.',
      },
    ]);
    return (
      <div className="max-w-lg">
        <FileUpload
          label="Supporting documents"
          hint="Weighbridge slips, signed forms or photos."
          accept={['application/pdf', 'image/*', '.xlsx']}
          maxSizeBytes={10 * 1024 * 1024}
          multiple
          files={files}
          onFilesChange={setFiles}
        />
      </div>
    );
  },
};
