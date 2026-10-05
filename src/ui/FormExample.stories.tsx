import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod';

import {
  type ApiErrorDetail,
  applyServerErrors,
  useFormField,
  useZodForm,
  zBusinessDate,
  zMoney,
  zQuantity,
} from '@/lib/forms';

import { Button } from './Button';
import { DatePicker } from './DatePickers';
import { MoneyInput, QuantityInput } from './DecimalInputs';
import { Input } from './Input';
import { Select } from './Select';

const schema = z.object({
  date: zBusinessDate(),
  division: z.string({ error: 'Choose a division.' }).min(1, 'Choose a division.'),
  rate: zMoney({ positive: true, scale: 4 }),
  lines: z
    .array(
      z.object({
        worker: z.string().min(1, 'Enter the worker code.'),
        quantity: zQuantity({ positive: true }),
      }),
    )
    .min(1),
});

type Values = z.input<typeof schema>;

/** What the server would answer with: one field error on line 2's quantity, and one form-level error. */
const SERVER_ERRORS: ApiErrorDetail[] = [
  {
    field: 'lines.1.quantity',
    code: 'VALIDATION_FAILED',
    message: 'More than the 60.000 kg daily limit for one worker.',
  },
  { code: 'PERIOD_CLOSED', message: 'The muster for this date has already been closed by the Manager.' },
];

function LineRow({
  index,
  form,
}: {
  readonly index: number;
  readonly form: ReturnType<typeof useZodForm<typeof schema>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        label={`Worker code, line ${index + 1}`}
        {...useFormField(form.control, `lines.${index}.worker`)}
      />
      <QuantityInput
        label={`Leaf, line ${index + 1}`}
        {...useFormField(form.control, `lines.${index}.quantity`)}
      />
    </div>
  );
}

function PluckingForm() {
  const [formErrors, setFormErrors] = useState<ApiErrorDetail[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const form = useZodForm(schema, {
    defaultValues: {
      date: '2026-10-04',
      division: '',
      rate: '8.2550',
      lines: [
        { worker: 'EMP-00042', quantity: '41.250' },
        { worker: 'EMP-00043', quantity: '72.000' },
      ],
    } satisfies Values,
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });

  return (
    <form
      noValidate
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          // Pretend the server refused it: map its details onto the fields.
          setSubmitted(JSON.stringify(values));
          setFormErrors(applyServerErrors(form, SERVER_ERRORS));
        })(event);
      }}
    >
      {formErrors.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-danger bg-danger-subtle p-3 text-sm text-danger"
        >
          {formErrors.map((detail) => (
            <p key={detail.code}>{detail.message}</p>
          ))}
        </div>
      ) : null}
      <DatePicker label="Plucking date" isRequired {...useFormField(form.control, 'date')} />
      <Select
        label="Division"
        isRequired
        options={[
          { id: 'd1', label: 'Division 1' },
          { id: 'd2', label: 'Division 2' },
        ]}
        {...useFormField(form.control, 'division')}
      />
      <MoneyInput label="Rate per kg" scale={4} isRequired {...useFormField(form.control, 'rate')} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium text-fg">Lines</legend>
        {lines.fields.map((line, index) => (
          <LineRow key={line.id} index={index} form={form} />
        ))}
      </fieldset>
      <div className="flex gap-3">
        <Button type="submit">Submit muster</Button>
        <Button
          variant="secondary"
          onPress={() => {
            lines.append({ worker: '', quantity: '' });
          }}
        >
          Add line
        </Button>
      </div>
      {submitted ? (
        <p className="text-sm text-fg-muted">
          Sent: <code className="font-mono break-all text-fg">{submitted}</code>
        </p>
      ) : null}
    </form>
  );
}

const meta = {
  title: 'Forms/Form example',
  parameters: {
    docs: {
      description: {
        component: [
          'React Hook Form + Zod with the ui controls (Spec P5 §10.2).',
          '',
          '- `useZodForm(schema)` validates on touch and focuses the first error on submit.',
          '- `useFormField(form.control, name)` connects a field to any ui control.',
          '- `zMoney`, `zQuantity`, `zBusinessDate`, `zTimeOfDay` mirror the backend rules and keep strings.',
          '- `applyServerErrors(form, details)` puts each server error on its field (`lines.1.quantity` lands on',
          '  line 2), focuses the first, and returns field-less errors for an alert.',
          '',
          'Press **Submit muster** with Division empty to see client validation; choose a division and submit to',
          'see the server errors land on line 2 and above the form.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;

export const PluckingMuster: StoryObj<typeof meta> = { render: () => <PluckingForm /> };
