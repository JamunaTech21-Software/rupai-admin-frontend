import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DatePicker, Input, MoneyInput, QuantityInput } from '@/ui';

import {
  type ApiErrorDetail,
  applyServerErrors,
  useFormField,
  useZodForm,
  zBusinessDate,
  zDecimalString,
  zMoney,
  zQuantity,
  zTimeOfDay,
} from './forms';

const messages = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues.map((issue) => issue.message) ?? [];

describe('domain schemas', () => {
  it('zMoney keeps the string and allows 2 places by default', () => {
    expect(zMoney().parse('1250.50')).toBe('1250.50');
    expect(messages(zMoney(), '1250.505')).toEqual(['Use at most 2 decimal places.']);
    expect(zMoney({ scale: 4 }).parse('8.2550')).toBe('8.2550');
  });

  it('zMoney refuses numbers, exponents and missing values with plain messages', () => {
    expect(messages(zMoney(), 12.5)).toEqual(['Enter an amount.']);
    expect(messages(zMoney(), undefined)).toEqual(['Enter an amount.']);
    expect(messages(zMoney(), '1e3')).toEqual(['Enter a number such as 1250.50.']);
  });

  it('checks bounds with decimal arithmetic', () => {
    expect(messages(zMoney({ positive: true }), '0.00')).toEqual(['Must be greater than 0.']);
    expect(messages(zMoney({ min: '10' }), '9.99')).toEqual(['Must be at least 10.']);
    expect(messages(zMoney({ max: '0.3' }), '0.30')).toEqual([]);
    expect(messages(zMoney({ max: '0.3' }), '0.31')).toEqual(['Must be at most 0.3.']);
  });

  it('refuses a value too large for the column', () => {
    expect(messages(zQuantity(), '123456789012.000')).toEqual(['This number is too large.']);
    expect(messages(zDecimalString('pct'), '123456.0')).toEqual(['This number is too large.']);
  });

  it('zQuantity allows grams (3 places)', () => {
    expect(zQuantity().parse('41.250')).toBe('41.250');
    expect(messages(zQuantity(), '41.2501')).toEqual(['Use at most 3 decimal places.']);
  });

  it('zBusinessDate and zTimeOfDay refuse malformed values', () => {
    expect(zBusinessDate().parse('2026-10-04')).toBe('2026-10-04');
    expect(messages(zBusinessDate(), '2026-02-30')).toEqual(['Enter a valid date.']);
    expect(messages(zBusinessDate(), null)).toEqual(['Choose a date.']);
    expect(zTimeOfDay().parse('07:30')).toBe('07:30');
    expect(messages(zTimeOfDay(), '25:00')).toEqual(['Enter a valid time.']);
  });
});

const schema = z.object({
  date: zBusinessDate(),
  rate: zMoney({ positive: true, scale: 4 }),
  lines: z.array(z.object({ worker: z.string().min(1, 'Enter the worker code.'), quantity: zQuantity() })),
});

const SERVER_ERRORS: ApiErrorDetail[] = [
  { field: 'lines.1.quantity', code: 'VALIDATION_FAILED', message: 'More than the daily limit.' },
  { field: 'rate', code: 'VALIDATION_FAILED', message: 'Rate is not the published rate.' },
  { code: 'PERIOD_CLOSED', message: 'The muster for this date is closed.' },
];

function Line({ index, form }: { index: number; form: ReturnType<typeof useZodForm<typeof schema>> }) {
  return (
    <>
      <Input label={`Worker, line ${index + 1}`} {...useFormField(form.control, `lines.${index}.worker`)} />
      <QuantityInput
        label={`Leaf, line ${index + 1}`}
        {...useFormField(form.control, `lines.${index}.quantity`)}
      />
    </>
  );
}

function MusterForm({
  onValid,
  serverErrors,
}: {
  onValid: (values: z.output<typeof schema>) => void;
  serverErrors?: ApiErrorDetail[];
}) {
  const [unplaced, setUnplaced] = useState<ApiErrorDetail[]>([]);
  const form = useZodForm(schema, {
    defaultValues: {
      date: '2026-10-04',
      rate: '12345.6700',
      lines: [
        { worker: 'EMP-1', quantity: '41.250' },
        { worker: 'EMP-2', quantity: '72.000' },
      ],
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          onValid(values);
          if (serverErrors) setUnplaced(applyServerErrors(form, serverErrors));
        })(event);
      }}
    >
      {unplaced.map((detail) => (
        <p key={detail.code} role="alert">
          {detail.message}
        </p>
      ))}
      <DatePicker label="Date" {...useFormField(form.control, 'date')} />
      <MoneyInput label="Rate" scale={4} {...useFormField(form.control, 'rate')} />
      <Line index={0} form={form} />
      <Line index={1} form={form} />
      <button type="submit">Submit</button>
    </form>
  );
}

describe('useZodForm with the ui controls', () => {
  it('submits money, quantities and dates as the exact strings it was given', async () => {
    const onValid = vi.fn();
    render(<MusterForm onValid={onValid} />);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onValid).toHaveBeenCalledWith({
      date: '2026-10-04',
      rate: '12345.6700',
      lines: [
        { worker: 'EMP-1', quantity: '41.250' },
        { worker: 'EMP-2', quantity: '72.000' },
      ],
    });
  });

  it('shows the client error on the field and focuses the first invalid one', async () => {
    const onValid = vi.fn();
    render(<MusterForm onValid={onValid} />);
    await userEvent.clear(screen.getByRole('textbox', { name: /Worker, line 2/ }));
    await userEvent.clear(screen.getByRole('textbox', { name: /Rate/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onValid).not.toHaveBeenCalled();
    const rate = screen.getByRole('textbox', { name: /Rate/ });
    expect(rate).toHaveFocus();
    expect(rate).toHaveAccessibleDescription(/Enter an amount\./);
    expect(screen.getByRole('textbox', { name: /Worker, line 2/ })).toHaveAccessibleDescription(
      'Enter the worker code.',
    );
  });

  it('puts server errors on the right line field, focuses the first, and returns the rest', async () => {
    render(<MusterForm onValid={vi.fn()} serverErrors={SERVER_ERRORS} />);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    const line2 = screen.getByRole('textbox', { name: /Leaf, line 2/ });
    expect(line2).toHaveFocus();
    expect(line2).toHaveAttribute('aria-invalid', 'true');
    expect(line2).toHaveAccessibleDescription(/More than the daily limit\./);
    expect(screen.getByRole('textbox', { name: /Leaf, line 1/ })).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('textbox', { name: /Rate/ })).toHaveAccessibleDescription(
      /Rate is not the published rate\./,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The muster for this date is closed.');
  });
});

describe('applyServerErrors', () => {
  it('focuses only the first placed error', () => {
    const setError = vi.fn();
    const rest = applyServerErrors({ setError }, SERVER_ERRORS);
    expect(setError.mock.calls).toEqual([
      ['lines.1.quantity', { type: 'server', message: 'More than the daily limit.' }, { shouldFocus: true }],
      ['rate', { type: 'server', message: 'Rate is not the published rate.' }, { shouldFocus: false }],
    ]);
    expect(rest).toEqual([SERVER_ERRORS[2]]);
  });

  it('returns everything when no detail names a field', () => {
    const setError = vi.fn();
    expect(applyServerErrors({ setError }, [{ code: 'X', message: 'Nope' }])).toHaveLength(1);
    expect(setError).not.toHaveBeenCalled();
  });
});
