import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type BusinessDate } from '@/types';

import { axeViolations } from '../../tests/axe';

import { AsyncCombobox, type ComboboxOption, type LoadOptionsArgs } from './AsyncCombobox';
import { Checkbox, CheckboxGroup, RadioGroup, Switch } from './Choice';
import { DatePicker, DateRangePicker, TimeInput } from './DatePickers';
import { MoneyInput, QuantityInput } from './DecimalInputs';
import { FormField } from './Field';
import { FileUpload, type UploadFile } from './FileUpload';
import { Input } from './Input';
import { NumberInput } from './NumberInput';
import { MultiSelect, Select } from './Select';
import { Textarea } from './Textarea';

afterEach(() => {
  vi.useRealTimers();
});

/** A controlled MoneyInput that records every value it reports. */
function ControlledMoney({
  initial,
  onValue,
}: {
  initial: string | null;
  onValue: (v: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
      label="Rate"
      scale={4}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('round-trips 12345.6700 exactly: shown grouped, edited raw, never changed unless edited', async () => {
    const onValue = vi.fn();
    render(
      <>
        <ControlledMoney initial="12345.6700" onValue={onValue} />
        <button type="button">Elsewhere</button>
      </>,
    );
    const input = screen.getByRole('textbox', { name: /Rate/ });
    expect(input).toHaveValue('12,345.67');

    await userEvent.click(input);
    expect(input).toHaveValue('12345.6700');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(input).toHaveValue('12,345.67');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('reports the typed digits as a decimal string, never a number', async () => {
    const onValue = vi.fn();
    render(<ControlledMoney initial={null} onValue={onValue} />);
    await userEvent.type(screen.getByRole('textbox', { name: /Rate/ }), '1,234.50');
    expect(onValue).toHaveBeenLastCalledWith('1234.50');
    expect(onValue.mock.calls.every(([v]) => v === null || typeof v === 'string')).toBe(true);
  });

  it('refuses letters, a second point and a fifth decimal place', async () => {
    const onValue = vi.fn();
    render(<ControlledMoney initial={null} onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: /Rate/ });
    await userEvent.type(input, '8a.2.55019');
    expect(input).toHaveValue('8.2550');
    expect(onValue).toHaveBeenLastCalledWith('8.2550');
  });

  it('reports null when cleared, and names the currency for screen readers', async () => {
    const onValue = vi.fn();
    render(<ControlledMoney initial="5" onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: /Rate/ });
    expect(input).toHaveAccessibleDescription('In Taka.');
    await userEvent.clear(input);
    expect(onValue).toHaveBeenLastCalledWith(null);
  });
});

describe('QuantityInput', () => {
  it('shows 3 places with its unit and refuses a fourth', async () => {
    const onChange = vi.fn();
    function Qty() {
      const [value, setValue] = useState<string | null>('1250.5');
      return (
        <QuantityInput
          label="Leaf"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    const { container } = render(<Qty />);
    const input = screen.getByRole('textbox', { name: /Leaf/ });
    expect(input).toHaveValue('1,250.500');
    expect(container).toHaveTextContent('kg');
    await userEvent.clear(input);
    await userEvent.type(input, '41.2509');
    expect(input).toHaveValue('41.250');
    expect(onChange).toHaveBeenLastCalledWith('41.250');
  });
});

describe('NumberInput', () => {
  it('steps with the arrow keys and reports null when empty', async () => {
    const onChange = vi.fn();
    function Count() {
      const [value, setValue] = useState<number | null>(5);
      return (
        <NumberInput
          label="Workers"
          value={value}
          minValue={0}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    render(<Count />);
    const input = screen.getByRole('textbox', { name: 'Workers' });
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(6);
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('Input and Textarea', () => {
  it('wire the label, required state, hint and error', () => {
    render(
      <>
        <Input label="Worker name" isRequired hint="As on the NID." error="Enter a name." />
        <Textarea label="Note" hint="Optional." />
      </>,
    );
    const input = screen.getByRole('textbox', { name: /Worker name/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('As on the NID. Enter a name.');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveAccessibleDescription('Optional.');
  });

  it('keep and report typed text without a value prop (uncontrolled)', async () => {
    const onChange = vi.fn();
    render(
      <>
        <Input label="Code" onChange={onChange} />
        <Textarea label="Reason" maxLength={50} />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Code' });
    await userEvent.type(input, 'AB');
    expect(input).toHaveValue('AB');
    expect(onChange).toHaveBeenLastCalledWith('AB');

    await userEvent.type(screen.getByRole('textbox', { name: 'Reason' }), 'Rain');
    expect(screen.getByText('4 of 50')).toBeInTheDocument();
  });
});

describe('FormField', () => {
  it('hands a custom control the ids that tie it to its label, hint and error', async () => {
    const { container } = render(
      <FormField label="Colour" hint="Pick one." error="Required." isRequired>
        {(aria) => <input {...aria} />}
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: /Colour/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAccessibleDescription('Pick one. Required.');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Select and MultiSelect', () => {
  const options = [
    { id: 'd1', label: 'Division 1' },
    { id: 'd2', label: 'Division 2' },
  ];

  it('Select picks one option with the keyboard', async () => {
    const onChange = vi.fn();
    render(<Select label="Division" options={options} onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(within(listbox).getByRole('option', { name: 'Division 2' }));
    expect(onChange).toHaveBeenLastCalledWith('d2');
    // Uncontrolled: the choice stays on screen.
    expect(screen.getByRole('button', { name: /Division/ })).toHaveTextContent('Division 2');
  });

  it('MultiSelect keeps several', async () => {
    const onChange = vi.fn();
    function Multi() {
      const [value, setValue] = useState<string[]>(['d1']);
      return (
        <MultiSelect
          label="Divisions"
          options={options}
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    render(<Multi />);
    await userEvent.click(screen.getByRole('button', { name: /Divisions/ }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(within(listbox).getByRole('option', { name: 'Division 2' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining(['d1', 'd2']));
  });
});

describe('Checkbox, RadioGroup and Switch', () => {
  it('a checkbox can be indeterminate (some rows selected)', () => {
    render(
      <Checkbox isIndeterminate onChange={vi.fn()}>
        Select all
      </Checkbox>,
    );
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBePartiallyChecked();
  });

  it('toggle with the keyboard', async () => {
    const onCheck = vi.fn();
    const onSwitch = vi.fn();
    const onRadio = vi.fn();
    const onGroup = vi.fn();
    render(
      <>
        <Checkbox onChange={onCheck}>Accept</Checkbox>
        <Switch onChange={onSwitch}>Active</Switch>
        <RadioGroup
          label="Shift"
          options={[
            { id: 'am', label: 'Morning' },
            { id: 'pm', label: 'Evening' },
          ]}
          onChange={onRadio}
        />
        <CheckboxGroup label="Days" options={[{ id: 'sat', label: 'Saturday' }]} onChange={onGroup} />
      </>,
    );
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onCheck).toHaveBeenLastCalledWith(true);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onSwitch).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('radio', { name: 'Evening' }));
    expect(onRadio).toHaveBeenLastCalledWith('pm');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Saturday' }));
    expect(onGroup).toHaveBeenLastCalledWith(['sat']);
  });
});

describe('DatePicker', () => {
  it('shows a business date without shifting it, and types a new one', async () => {
    const onChange = vi.fn();
    function Picker() {
      const [value, setValue] = useState<BusinessDate | null>('2026-10-04' as BusinessDate);
      return (
        <DatePicker
          label="Plucking date"
          name="date"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    const { container } = render(<Picker />);
    expect(container.querySelector('input[name="date"]')).toHaveValue('2026-10-04');

    const [first] = screen.getAllByRole('spinbutton');
    if (!first) throw new Error('no date segments');
    await userEvent.click(first);
    await userEvent.keyboard('12312026');
    expect(onChange).toHaveBeenLastCalledWith('2026-12-31');
  });

  it('"Today" is today in Asia/Dhaka, even when it is still yesterday in UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T19:30:00Z'));
    const onChange = vi.fn();
    render(<DatePicker label="Plucking date" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-05');
  });

  it('a range preset fills both ends', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-04T19:30:00Z'));
    const onChange = vi.fn();
    render(<DateRangePicker label="Period" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Last month' }));
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-01', end: '2026-09-30' });
  });
});

describe('TimeInput', () => {
  it('types a 24-hour time as HH:mm', async () => {
    const onChange = vi.fn();
    function Time() {
      const [value, setValue] = useState<string | null>('07:30');
      return (
        <TimeInput
          label="Shift start"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    render(<Time />);
    const [hour, minute] = screen.getAllByRole('spinbutton');
    if (!hour || !minute) throw new Error('no time segments');
    expect(hour).toHaveAttribute('aria-valuenow', '7');
    expect(minute).toHaveAttribute('aria-valuenow', '30');
    await userEvent.click(hour);
    await userEvent.keyboard('1445');
    expect(onChange).toHaveBeenLastCalledWith('14:45');
  });
});

describe('FileUpload', () => {
  function pdf(name: string, bytes: number) {
    const file = new File(['%PDF'], name, { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: bytes });
    return file;
  }

  function Upload({ onFiles }: { onFiles: (files: UploadFile[]) => void }) {
    const [files, setFiles] = useState<UploadFile[]>([]);
    return (
      <FileUpload
        label="Signed muster"
        accept={['application/pdf']}
        maxSizeBytes={1024 * 1024}
        multiple
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          onFiles(next);
        }}
      />
    );
  }

  it('adds accepted files and refuses the wrong type or size with the reason', async () => {
    const onFiles = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Upload onFiles={onFiles} />);
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!picker) throw new Error('no file input');

    await user.upload(picker, [
      pdf('muster.pdf', 2048),
      pdf('huge.pdf', 5 * 1024 * 1024),
      new File(['x'], 'photo.exe', { type: 'application/x-msdownload' }),
    ]);

    expect(onFiles).toHaveBeenLastCalledWith([expect.objectContaining({ status: 'pending' })]);
    const list = screen.getByRole('list', { name: 'Attached files' });
    expect(within(list).getByText('muster.pdf')).toBeInTheDocument();
    // Visible reasons (the same text is also announced in the live region).
    expect(
      screen.getByText(/huge\.pdf: larger than 1\.0 MB \(5\.0 MB\)/, { selector: 'li' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/photo\.exe: this file type is not accepted/, { selector: 'li' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove muster.pdf' }));
    expect(onFiles).toHaveBeenLastCalledWith([]);
  });

  it('shows upload progress', () => {
    const file = pdf('muster.pdf', 2048);
    render(
      <FileUpload
        label="Signed muster"
        accept={['.pdf']}
        maxSizeBytes={1024}
        files={[{ id: '1', file, status: 'uploading', progress: 40 }]}
        onFilesChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Uploading muster.pdf' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });
});

describe('AsyncCombobox', () => {
  const workers: ComboboxOption[] = [
    { id: 'w1', label: 'Rahim Uddin', description: 'EMP-00042' },
    { id: 'w2', label: 'Rina Begum', description: 'EMP-00043' },
  ];

  it('searches the server once per pause in typing, and picks a result', async () => {
    const loadOptions = vi.fn(({ query }: LoadOptionsArgs) =>
      Promise.resolve({
        items: workers.filter((w) => w.label.toLowerCase().includes(query.toLowerCase())),
      }),
    );
    const onChange = vi.fn();
    // A realistic pause: keystrokes in a test come far faster than 400 ms apart, even on a busy machine.
    render(<AsyncCombobox label="Worker" loadOptions={loadOptions} debounceMs={400} onChange={onChange} />);

    await userEvent.type(screen.getByRole('combobox', { name: /Worker/ }), 'rin');
    const option = await screen.findByRole('option', { name: /Rina Begum/ }, { timeout: 5000 });
    const queries = loadOptions.mock.calls.map(([args]) => args.query);
    expect(queries).not.toContain('r');
    expect(queries).not.toContain('ri');
    expect(queries.at(-1)).toBe('rin');
    expect(screen.queryByRole('option', { name: /Rahim/ })).not.toBeInTheDocument();

    await userEvent.click(option);
    expect(onChange).toHaveBeenLastCalledWith(workers[1]);
  });

  it('says so when nothing matches', async () => {
    render(
      <AsyncCombobox
        label="Worker"
        debounceMs={10}
        loadOptions={() => Promise.resolve({ items: [] })}
        emptyMessage="No matches."
      />,
    );
    await userEvent.type(screen.getByRole('combobox', { name: /Worker/ }), 'zz');
    await waitFor(() => {
      expect(screen.getByText('No matches.')).toBeInTheDocument();
    });
  });
});
