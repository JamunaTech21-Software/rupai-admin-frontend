import { type Ref } from 'react';
import {
  Collection,
  ComboBox,
  Group,
  Input as AriaInput,
  ListBox,
  ListBoxItem,
  ListBoxLoadMoreItem,
  Popover,
  Button as AriaButton,
  useAsyncList,
} from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { controlBox, type FieldProps, fieldWrapper, innerInput, listItem, popover } from './fieldStyles';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

export interface ComboboxOption {
  readonly id: string;
  readonly label: string;
  /** A second line: a code, a division, an employee number. */
  readonly description?: string;
}

/** One page of search results. `nextCursor` loads the next page when the user scrolls to the end. */
export interface ComboboxPage {
  readonly items: readonly ComboboxOption[];
  readonly nextCursor?: string | null;
}

export interface LoadOptionsArgs {
  readonly query: string;
  readonly cursor: string | null;
  /** Aborted when the query changes, so a stale response never replaces a fresh one. */
  readonly signal: AbortSignal;
}

export interface AsyncComboboxProps extends FieldProps {
  /**
   * The selected record as `{ id, label }`, so an existing value shows without loading the list first.
   */
  readonly value?: ComboboxOption | null | undefined;
  readonly onChange?: (value: ComboboxOption | null) => void;
  /** Server search (F0.06 api hook): paginated, filtered by `query`. */
  readonly loadOptions: (args: LoadOptionsArgs) => Promise<ComboboxPage>;
  /** Wait this long after the last keystroke before searching. */
  readonly debounceMs?: number;
  readonly placeholder?: string;
  /** Shown when the search returns nothing. */
  readonly emptyMessage?: string;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Search and pick one record from a large set (tens of thousands of workers, suppliers, fields). It searches
 * the server as you type (debounced, earlier requests cancelled) and loads more as you scroll.
 */
export function AsyncCombobox({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  inputRef,
  className,
  value,
  onChange,
  loadOptions,
  debounceMs = 300,
  placeholder = 'Type to search…',
  emptyMessage = 'No matches. Try another spelling or a code.',
}: AsyncComboboxProps) {
  const list = useAsyncList<ComboboxOption>({
    initialFilterText: value?.label ?? '',
    async load({ signal, cursor, filterText }) {
      if (!cursor) await wait(debounceMs, signal);
      const page = await loadOptions({ query: filterText ?? '', cursor: cursor ?? null, signal });
      return { items: [...page.items], ...(page.nextCursor ? { cursor: page.nextCursor } : {}) };
    },
  });

  const isSearching = list.loadingState === 'loading' || list.loadingState === 'filtering';

  return (
    <ComboBox
      items={list.items}
      inputValue={list.filterText}
      onInputChange={(text) => {
        list.setFilterText(text);
      }}
      value={value?.id ?? null}
      onChange={(key) => {
        const option = list.items.find((item) => item.id === key) ?? null;
        onChange?.(option);
      }}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      menuTrigger="focus"
      allowsEmptyCollection
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Group className={controlBox} isInvalid={Boolean(error)} isDisabled={isDisabled ?? false}>
        <Icon name="search" size="sm" className="text-fg-muted" />
        <AriaInput
          ref={inputRef as Ref<HTMLInputElement> | undefined}
          placeholder={placeholder}
          className={innerInput}
        />
        {isSearching ? <Spinner size="sm" label="Searching" /> : null}
        <AriaButton aria-label="Show results" className="flex items-center text-fg-muted">
          <Icon name="chevronDown" size="sm" />
        </AriaButton>
      </Group>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
      <Popover className={popover}>
        <ListBox
          className="outline-none"
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-fg-muted">{isSearching ? 'Searching…' : emptyMessage}</p>
          )}
        >
          <Collection items={list.items}>
            {(option) => (
              <ListBoxItem id={option.id} textValue={option.label} className={listItem}>
                {({ isSelected }) => (
                  <>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-sm text-fg-muted">{option.description}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Icon name="check" size="sm" className="text-primary" /> : null}
                  </>
                )}
              </ListBoxItem>
            )}
          </Collection>
          <ListBoxLoadMoreItem
            onLoadMore={() => {
              list.loadMore();
            }}
            isLoading={list.loadingState === 'loadingMore'}
            className="flex justify-center py-2"
          >
            <Spinner size="sm" label="Loading more" />
          </ListBoxLoadMoreItem>
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
