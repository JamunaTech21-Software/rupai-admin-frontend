import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Checkbox, CheckboxGroup, RadioGroup, Switch } from './Choice';
import { Input } from './Input';
import { MultiSelect, Select } from './Select';
import { Textarea } from './Textarea';

const DIVISIONS = [
  { id: 'd1', label: 'Division 1', description: 'North slope' },
  { id: 'd2', label: 'Division 2', description: 'River side' },
  { id: 'd3', label: 'Division 3', description: 'Factory block' },
  { id: 'd4', label: 'Division 4', description: 'Nursery', isDisabled: true },
];

const meta = {
  title: 'Forms/Controls',
  parameters: {
    docs: {
      description: {
        component: [
          'Generic form controls. Every control takes `label` (required: the accessible name), `hint`, `error`,',
          '`isRequired`, `isDisabled`, and `value` / `onChange`. Spread `useFormField(form.control, name)` onto any',
          'of them to connect it to a form.',
          '',
          '**Usage rules**',
          '- Always a visible label; `hideLabel` only inside an editable table row, where the column names it.',
          '- `hint` for format help ("As on the NID card"); `error` says what is wrong and how to fix it.',
          '- Select for a short known list (under ~50); AsyncCombobox to search many records; RadioGroup when',
          '  up to ~5 options should all be visible; Checkbox for yes/no saved with the form; Switch for a setting',
          '  that takes effect immediately.',
          '- Never use Input for money, quantities, numbers, dates or times: use the domain inputs.',
        ].join('\n'),
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInputs: Story = {
  render: function Render() {
    const [name, setName] = useState('Rahim Uddin');
    const [remarks, setRemarks] = useState('');
    return (
      <div className="grid max-w-xl gap-4">
        <Input
          label="Worker name"
          value={name}
          onChange={setName}
          isRequired
          hint="As written on the NID card."
        />
        <Input label="Phone" type="tel" value="" placeholder="01XXXXXXXXX" />
        <Input label="Employee code" value="EMP-0042" isReadOnly />
        <Input label="Old code" value="W-17" isDisabled />
        <Input
          label="Email"
          type="email"
          value="rahim@"
          error="Enter a complete email address, like name@example.com."
        />
        <Textarea
          label="Remarks"
          value={remarks}
          onChange={setRemarks}
          maxLength={200}
          hint="Shown on the muster."
        />
      </div>
    );
  },
};

export const Selects: Story = {
  render: function Render() {
    const [division, setDivision] = useState<string | null>(null);
    const [divisions, setDivisions] = useState<string[]>(['d1', 'd3']);
    return (
      <div className="grid max-w-xl gap-4">
        <Select label="Division" options={DIVISIONS} value={division} onChange={setDivision} isRequired />
        <MultiSelect
          label="Divisions in this report"
          options={DIVISIONS}
          value={divisions}
          onChange={setDivisions}
        />
        <Select label="Section" options={[]} value={null} error="Choose the section the worker belongs to." />
        <Select label="Garden" options={DIVISIONS} value="d2" isDisabled />
      </div>
    );
  },
};

export const Choices: Story = {
  render: function Render() {
    const [all, setAll] = useState<string[]>(['plucking']);
    const tasks = ['plucking', 'pruning', 'weeding'];
    const [shift, setShift] = useState<string>('morning');
    const [sms, setSms] = useState(true);
    return (
      <div className="grid max-w-xl gap-6">
        <div className="flex flex-col">
          <Checkbox
            isSelected={all.length === tasks.length}
            isIndeterminate={all.length > 0 && all.length < tasks.length}
            onChange={(on) => {
              setAll(on ? tasks : []);
            }}
          >
            All tasks
          </Checkbox>
          <div className="ps-7">
            {tasks.map((task) => (
              <Checkbox
                key={task}
                isSelected={all.includes(task)}
                onChange={(on) => {
                  setAll(on ? [...all, task] : all.filter((t) => t !== task));
                }}
              >
                <span className="capitalize">{task}</span>
              </Checkbox>
            ))}
          </div>
        </div>
        <CheckboxGroup
          label="Allowances"
          options={[
            { id: 'ration', label: 'Ration' },
            { id: 'firewood', label: 'Firewood' },
            { id: 'medical', label: 'Medical', isDisabled: true },
          ]}
          value={['ration']}
          error="Choose at least two allowances for permanent workers."
        />
        <RadioGroup
          label="Shift"
          options={[
            { id: 'morning', label: 'Morning (06:00–14:00)' },
            { id: 'evening', label: 'Evening (14:00–22:00)' },
          ]}
          value={shift}
          onChange={setShift}
          isRequired
        />
        <Switch isSelected={sms} onChange={setSms}>
          Send an SMS when payroll is approved
        </Switch>
        <Switch isSelected={false} isDisabled>
          Allow overtime (needs the Manager role)
        </Switch>
      </div>
    );
  },
};
