import { type Key } from 'react';
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import { Button } from './Button';
import { popover, listItem } from './fieldStyles';
import { Icon } from './Icon';
import { useUiText } from './uiText';

export interface ColumnChoice {
  readonly id: string;
  readonly label: string;
  /** The row-header column and other essentials cannot be hidden. */
  readonly canHide: boolean;
}

export interface ColumnsMenuProps {
  readonly columns: readonly ColumnChoice[];
  readonly visible: ReadonlySet<string>;
  readonly onVisibleChange: (visible: Set<string>) => void;
}

/** "Columns" menu: a checkable list of the table's columns. */
export function ColumnsMenu({ columns, visible, onVisibleChange }: ColumnsMenuProps) {
  const text = useUiText();
  return (
    <MenuTrigger>
      <Button variant="secondary" size="sm" iconStart="columns">
        {text.columns}
      </Button>
      <Popover className={popover} placement="bottom end">
        <Menu
          selectionMode="multiple"
          selectedKeys={visible}
          disabledKeys={columns.filter((column) => !column.canHide).map((column) => column.id)}
          onSelectionChange={(keys) => {
            if (keys === 'all') onVisibleChange(new Set(columns.map((column) => column.id)));
            else onVisibleChange(new Set([...keys].map((key: Key) => String(key))));
          }}
          className="outline-none"
        >
          {columns.map((column) => (
            <MenuItem key={column.id} id={column.id} textValue={column.label} className={listItem}>
              {({ isSelected }) => (
                <>
                  <span>{column.label}</span>
                  {isSelected ? <Icon name="check" size="sm" className="text-primary" /> : null}
                </>
              )}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
