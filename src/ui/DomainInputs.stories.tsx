import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { type BusinessDateRange } from '@/lib/dates';
import { type BusinessDate } from '@/types';

import { DatePicker, DateRangePicker, TimeInput } from './DatePickers';
import { MoneyInput, QuantityInput } from './DecimalInputs';
import { NumberInput } from './NumberInput';

const meta = {
  title: 'Forms/Domain inputs',
  parameters: {
    docs: {
      description: {
        component: [
          'Inputs for domain values. They must never be swapped for generic controls (Spec P5 §6.2).',
          '',
          '**Usage rules**',
          '- **MoneyInput**: a decimal string in and out ("12345.6700" stays exactly that unless edited). Shows',
          '  "12,345.67" on blur and the raw value while editing. Letters, a second point or too many places are',
          '  refused as you type. `scale={4}` for unit rates.',
          '- **QuantityInput**: kg to the gram (3 places), with the unit after the value.',
          '- **NumberInput**: plain counts and whole numbers only (workers, days). Never money or quantities.',
          '- **DatePicker / DateRangePicker**: business dates `YYYY-MM-DD`, typed (day, month and year segments) or',
          '  picked; presets such as Today and Last month. No timezone conversion ever happens, so a date picked',
          '  in Asia/Dhaka never shifts by a day.',
          '- **TimeInput**: a time of day `HH:mm`, 24-hour by default.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Money: Story = {
  render: function Render() {
    const [amount, setAmount] = useState<string | null>('12345.6700');
    const [rate, setRate] = useState<string | null>('8.2550');
    return (
      <div className="grid max-w-md gap-4">
        <MoneyInput label="Advance amount" value={amount} onChange={setAmount} isRequired />
        <p className="text-sm text-fg-muted">
          Value sent to the API: <code className="font-mono text-fg">{JSON.stringify(amount)}</code>
        </p>
        <MoneyInput label="Plucking rate per kg" value={rate} onChange={setRate} scale={4} />
        <MoneyInput
          label="Deduction"
          value="99.5"
          error="The deduction cannot exceed the gross wage (৳ 85.00)."
        />
        <MoneyInput label="Bonus" value="1500" isDisabled />
      </div>
    );
  },
};

export const Quantities: Story = {
  render: function Render() {
    const [leaf, setLeaf] = useState<string | null>('1250.5');
    const [workers, setWorkers] = useState<number | null>(24);
    return (
      <div className="grid max-w-md gap-4">
        <QuantityInput label="Green leaf plucked" value={leaf} onChange={setLeaf} isRequired />
        <p className="text-sm text-fg-muted">
          Value: <code className="font-mono text-fg">{JSON.stringify(leaf)}</code>
        </p>
        <NumberInput
          label="Workers in the gang"
          value={workers}
          onChange={setWorkers}
          minValue={1}
          maxValue={200}
        />
        <QuantityInput label="Made tea" value="" error="Enter the made-tea weight from the dryer log." />
      </div>
    );
  },
};

export const Dates: Story = {
  render: function Render() {
    const [date, setDate] = useState<BusinessDate | null>('2026-10-04' as BusinessDate);
    const [range, setRange] = useState<BusinessDateRange | null>(null);
    const [time, setTime] = useState<string | null>('06:30');
    return (
      <div className="grid max-w-md gap-4">
        <DatePicker label="Muster date" value={date} onChange={setDate} isRequired />
        <p className="text-sm text-fg-muted">
          Value: <code className="font-mono text-fg">{JSON.stringify(date)}</code>
        </p>
        <DateRangePicker label="Pay period" value={range} onChange={setRange} />
        <TimeInput label="Shift starts" value={time} onChange={setTime} />
        <DatePicker
          label="Date of joining"
          value={null}
          maxValue={'2026-10-04' as BusinessDate}
          error="Choose the date the worker joined the estate."
        />
      </div>
    );
  },
};
