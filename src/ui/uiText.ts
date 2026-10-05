import { createContext, useContext } from 'react';

import { type DocumentState } from './tokens';

/**
 * Every word the component library shows or announces by itself (F0.07, Spec P5 §14). ui/ does not depend on
 * the i18n library: UiProvider receives this dictionary in the active language (app/ builds it from the `ui`
 * namespace) and components read it with useUiText(). English is the default, so stories and tests need no
 * setup. Words that belong to a screen (labels, titles) are props, translated by the feature.
 */
export interface UiText {
  /** BCP 47 locale for numbers: `en-US` (1,240) or `bn-BD` (১,২৪০). */
  readonly numberLocale: string;
  /** BCP 47 locale for dates and times: `en-GB` (4 Oct 2026) or `bn-BD`. */
  readonly dateLocale: string;

  readonly close: string;
  readonly dismiss: string;
  readonly cancel: string;
  readonly tryAgain: string;
  readonly actionFailed: string;
  readonly loading: string;
  readonly updating: string;
  readonly notSet: string;
  readonly unnamedPerson: string;
  readonly choose: string;

  // ErrorState
  readonly errorTitle: string;
  readonly errorMessage: string;
  readonly reference: string;
  readonly copyReference: string;
  readonly referenceCopied: string;

  // Toasts
  readonly notifications: string;
  readonly closeNotification: string;

  // Combobox
  readonly typeToSearch: string;
  readonly noMatches: string;
  readonly searching: string;
  readonly loadingMore: string;
  readonly showResults: string;

  // DataTable and Pagination
  readonly columns: string;
  readonly sortBy: string;
  readonly sortOption: (column: string, descending: boolean) => string;
  readonly bulkActions: string;
  readonly selectedCount: (count: string) => string;
  readonly clearSelection: string;
  readonly selectAllOnPage: string;
  readonly selectRow: (row: string) => string;
  readonly allOnPageSelected: (count: string) => string;
  readonly selectionCleared: string;
  readonly loadMore: string;
  readonly showing: (count: string, isAll: boolean) => string;
  readonly noRows: (label: string) => string;
  readonly loadFailed: (label: string) => string;
  readonly rowsPerPage: string;
  readonly pagination: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly pageNumber: (page: string) => string;
  readonly pageOf: (page: string, pages: string) => string;
  readonly range: (first: string, last: string, total: string, items: string) => string;
  readonly noItems: (items: string) => string;
  readonly rows: string;

  // Navigation and layout
  readonly mainNavigation: string;
  readonly navigation: string;
  readonly breadcrumbs: string;
  readonly openNavigation: string;
  readonly closeNavigation: string;
  readonly expandNavigation: string;
  readonly collapseNavigation: string;
  readonly skipToMain: string;
  readonly needAttention: (count: string) => string;
  readonly account: (name: string) => string;
  readonly step: (index: string, total: string, state: 'complete' | 'current' | 'upcoming') => string;
  readonly remove: (label: string) => string;
  readonly documentState: Readonly<Record<DocumentState, string>>;

  // Dates and domain inputs
  readonly calendar: (label: string) => string;
  /** Date preset buttons, by preset id (lib/dates DATE_PRESETS, DATE_RANGE_PRESETS). */
  readonly datePresets: Readonly<Record<string, string>>;
  readonly characterCount: (length: string, max: string) => string;
  readonly multiSelected: (count: string) => string;
  readonly currencyName: string;
  readonly kilograms: string;
  readonly inUnit: (unit: string) => string;

  // FileUpload
  readonly dropFilesHere: string;
  readonly chooseFile: string;
  readonly chooseFiles: string;
  readonly attachedFiles: string;
  readonly uploaded: string;
  readonly uploading: (file: string) => string;
  readonly fileRules: (types: string, maxSize: string, multiple: boolean) => string;
  readonly fileTypeRefused: (file: string) => string;
  readonly fileTooLarge: (file: string, maxSize: string, size: string) => string;
  readonly filesAdded: (count: number) => string;
  readonly fileRemoved: (file: string) => string;
}

export const UI_TEXT_EN: UiText = {
  numberLocale: 'en-US',
  dateLocale: 'en-GB',
  close: 'Close',
  dismiss: 'Dismiss',
  cancel: 'Cancel',
  tryAgain: 'Try again',
  actionFailed: 'That did not work. Try again.',
  loading: 'Loading',
  updating: 'Updating',
  notSet: 'Not set',
  unnamedPerson: 'Unnamed person',
  choose: 'Choose…',

  errorTitle: 'Something went wrong',
  errorMessage:
    'This could not be loaded. Try again; if it keeps happening, contact support with the reference below.',
  reference: 'Reference:',
  copyReference: 'Copy reference',
  referenceCopied: 'Reference copied.',

  notifications: 'Notifications',
  closeNotification: 'Close notification',

  typeToSearch: 'Type to search…',
  noMatches: 'No matches. Try another spelling or a code.',
  searching: 'Searching',
  loadingMore: 'Loading more',
  showResults: 'Show results',

  columns: 'Columns',
  sortBy: 'Sort by',
  sortOption: (column, descending) => `${column} (${descending ? 'descending' : 'ascending'})`,
  bulkActions: 'Bulk actions',
  selectedCount: (count) => `${count} selected`,
  clearSelection: 'Clear selection',
  selectAllOnPage: 'Select all rows on this page',
  selectRow: (row) => `Select ${row}`,
  allOnPageSelected: (count) => `All ${count} rows on this page selected.`,
  selectionCleared: 'Selection cleared.',
  loadMore: 'Load more',
  showing: (count, isAll) => `Showing ${count}${isAll ? ' (all)' : ''}`,
  noRows: (label) => `No ${label.toLowerCase()}.`,
  loadFailed: (label) => `${label} could not be loaded`,
  rowsPerPage: 'Rows per page',
  pagination: 'Pagination',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  pageNumber: (page) => `Page ${page}`,
  pageOf: (page, pages) => `Page ${page} of ${pages}`,
  range: (first, last, total, items) => `${first}–${last} of ${total} ${items}`,
  noItems: (items) => `No ${items}`,
  rows: 'rows',

  mainNavigation: 'Main',
  navigation: 'Navigation',
  breadcrumbs: 'Breadcrumbs',
  openNavigation: 'Open navigation',
  closeNavigation: 'Close navigation',
  expandNavigation: 'Expand navigation',
  collapseNavigation: 'Collapse navigation',
  skipToMain: 'Skip to main content',
  needAttention: (count) => `, ${count} need attention`,
  account: (name) => `Account: ${name}`,
  step: (index, total, state) =>
    `Step ${index} of ${total}${state === 'complete' ? ', complete' : state === 'current' ? ', current' : ''}`,
  remove: (label) => `Remove ${label}`,
  documentState: {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    posted: 'Posted',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  },

  calendar: (label) => `${label}: calendar`,
  datePresets: {
    today: 'Today',
    yesterday: 'Yesterday',
    'last-7-days': 'Last 7 days',
    'this-month': 'This month',
    'last-month': 'Last month',
  },
  characterCount: (length, max) => `${length} of ${max}`,
  multiSelected: (count) => `${count} selected`,
  currencyName: 'Taka',
  kilograms: 'kilograms',
  inUnit: (unit) => `In ${unit}.`,

  dropFilesHere: 'Drop files here, or',
  chooseFile: 'Choose a file',
  chooseFiles: 'Choose files',
  attachedFiles: 'Attached files',
  uploaded: 'Uploaded',
  uploading: (file) => `Uploading ${file}`,
  fileRules: (types, maxSize, multiple) => `${types} · up to ${maxSize}${multiple ? ' each' : ''}`,
  fileTypeRefused: (file) => `${file}: this file type is not accepted.`,
  fileTooLarge: (file, maxSize, size) => `${file}: larger than ${maxSize} (${size}).`,
  filesAdded: (count) => `${String(count)} file${count === 1 ? '' : 's'} added.`,
  fileRemoved: (file) => `${file} removed.`,
};

export const UiTextContext = createContext<UiText>(UI_TEXT_EN);

/** The component library's words in the active language. */
export function useUiText(): UiText {
  return useContext(UiTextContext);
}

/** Whole numbers in the active locale: 1,240 or ১,২৪০. */
export function formatCount(value: number, text: UiText): string {
  return new Intl.NumberFormat(text.numberLocale, { maximumFractionDigits: 0 }).format(value);
}
