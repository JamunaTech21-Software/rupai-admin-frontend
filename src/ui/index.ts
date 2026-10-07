/**
 * The component library: design tokens (F0.02), primitives (F0.03), form controls and domain inputs (F0.04),
 * data display, feedback and layout (F0.05). Built on React Aria Components (decision O-22). ui/ never imports
 * from features/ or app/, and features import UI only from here.
 */
export * from './tokens';
export { contrastRatio, relativeLuminance } from './contrast';
export { cx } from './cx';
export { announce, type Politeness } from './announce';
export { UiProvider, type UiProviderProps } from './UiProvider';
export { Icon, type IconProps } from './Icon';
export { icons, type IconName } from './iconSet';
export { VisuallyHidden } from './VisuallyHidden';
export { Spinner, type SpinnerProps } from './Spinner';
export { Button, type ButtonProps } from './Button';
export { type ButtonSize, type ButtonVariant } from './buttonStyles';
export { IconButton, type IconButtonProps } from './IconButton';
export { Link, type LinkProps } from './Link';
export { ButtonLink, type ButtonLinkProps } from './ButtonLink';
export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export { Tag, type TagProps } from './Tag';
export { Avatar, type AvatarProps } from './Avatar';
export { initialsOf } from './initials';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { Divider, type DividerProps } from './Divider';

// ---- Form controls and domain inputs (F0.04) --------------------------------------------------------------
export { type FieldProps } from './fieldStyles';
export {
  FieldErrorText,
  FieldHint,
  FieldLabel,
  FormField,
  type FormFieldAria,
  type FormFieldProps,
} from './Field';
export { Input, type InputProps } from './Input';
export { Textarea, type TextareaProps } from './Textarea';
export { MultiSelect, type MultiSelectProps, Select, type SelectOption, type SelectProps } from './Select';
export {
  AsyncCombobox,
  type AsyncComboboxProps,
  type ComboboxOption,
  type ComboboxPage,
  type LoadOptionsArgs,
} from './AsyncCombobox';
export {
  Checkbox,
  CheckboxGroup,
  type CheckboxGroupProps,
  type CheckboxProps,
  type ChoiceOption,
  RadioGroup,
  type RadioGroupProps,
  Switch,
  type SwitchProps,
} from './Choice';
export { MoneyInput, type MoneyInputProps, QuantityInput, type QuantityInputProps } from './DecimalInputs';
export { NumberInput, type NumberInputProps } from './NumberInput';
export {
  DatePicker,
  type DatePickerProps,
  DateRangePicker,
  type DateRangePickerProps,
  TimeInput,
  type TimeInputProps,
} from './DatePickers';
export { FileUpload, type FileUploadProps, type UploadFile } from './FileUpload';

// ---- Feedback and overlays (F0.05) ------------------------------------------------------------------------
export { Drawer, type DrawerProps, Modal, type ModalProps, OverlayTrigger } from './Modal';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { toast, type ToastTone } from './toastQueue';
export { ToastRegion } from './Toast';
export { Alert, type AlertProps } from './Alert';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { ProgressBar, type ProgressBarProps } from './ProgressBar';
export { Tooltip, type TooltipProps } from './Tooltip';

// ---- Data display (F0.05) ---------------------------------------------------------------------------------
export { Card, type CardProps } from './Card';
export { type DescriptionItem, DescriptionList, type DescriptionListProps } from './DescriptionList';
export { StatCard, type StatCardProps, type StatComparison, type StatDrillDown } from './StatCard';
export { Timeline, type TimelineEvent, type TimelineProps } from './Timeline';
export { type TabItem, Tabs, type TabsProps } from './Tabs';
export { Accordion, type AccordionItem, type AccordionProps } from './Accordion';
export { Tree, type TreeNode, type TreeProps } from './Tree';
export { type EmptyKind, EmptyState, type EmptyStateProps } from './EmptyState';
export { Pagination, type PaginationProps } from './Pagination';
export { pageWindow } from './pageWindow';

// ---- DataTable (F0.05) ------------------------------------------------------------------------------------
export { type DataColumn, DataTable, type DataTableProps } from './DataTable';
export { columnStorageKey } from './columnPreferences';
export { MD_UP, useMediaQuery } from './useMediaQuery';

// ---- Layout and app frame (F0.05) -------------------------------------------------------------------------
export { type Gap, Grid, Inline, Stack, Toolbar, type ToolbarProps } from './Layout';
export {
  Breadcrumbs,
  type BreadcrumbsProps,
  type Crumb,
  PageHeader,
  type PageHeaderProps,
} from './PageHeader';
export { type Step, Stepper, type StepperProps } from './Stepper';
export { type NavItem, type NavSection, Sidebar, type SidebarProps } from './Sidebar';
export { TopBar, type TopBarProps, UserMenu, type UserMenuItem, type UserMenuProps } from './TopBar';
export { AppShell, type AppShellProps } from './AppShell';

// ---- Words (F0.07) ----------------------------------------------------------------------------------------
export { formatCount, UI_TEXT_EN, type UiText, UiTextContext, useUiText } from './uiText';
