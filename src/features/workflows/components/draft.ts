import {
  type ApproverRule,
  type Condition,
  type DocumentType,
  type Operator,
  type StepBody,
  type Workflow,
  type WorkflowBody,
} from '../api/workflows';

/**
 * What the editor holds while a workflow is being written: every input as text, so half-typed values are kept. It
 * becomes the API's body only when it is sent (`toBody`), and a saved workflow becomes a draft again to be edited
 * (`fromWorkflow`).
 */
export interface ConditionDraft {
  field: string;
  operator: Operator | '';
  /** The value; for between, the lower bound; for in / not_in, a comma-separated list. */
  value: string;
  /** The upper bound of between. */
  upper: string;
}

export interface StepDraft {
  /** Stable while the list is reordered. */
  key: string;
  name: string;
  rule: ApproverRule;
  roleId: string;
  user: { id: string; label: string } | null;
  level: string;
  condition: ConditionDraft | null;
  allowSelf: boolean;
}

export interface WorkflowDraft {
  code: string;
  name: string;
  documentType: string;
  estateId: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  notes: string;
  conditions: ConditionDraft[];
  steps: StepDraft[];
}

let counter = 0;
export const newKey = () => `s${String((counter += 1))}`;

export const blankCondition = (): ConditionDraft => ({ field: '', operator: '', value: '', upper: '' });

export const blankStep = (): StepDraft => ({
  key: newKey(),
  name: '',
  rule: 'by_role',
  roleId: '',
  user: null,
  level: '1',
  condition: null,
  allowSelf: false,
});

export const blankDraft = (): WorkflowDraft => ({
  code: '',
  name: '',
  documentType: '',
  estateId: '',
  effectiveFrom: null,
  effectiveTo: null,
  notes: '',
  conditions: [],
  steps: [blankStep()],
});

const FLAGS: readonly Operator[] = ['is_true', 'is_false'];
export const isFlagOperator = (operator: Operator | ''): boolean =>
  operator !== '' && FLAGS.includes(operator);

const listOf = (text: string): string[] =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

function conditionDraft(condition: Condition): ConditionDraft {
  const { value } = condition;
  if (Array.isArray(value)) {
    return condition.operator === 'between'
      ? { field: condition.field, operator: condition.operator, value: value[0] ?? '', upper: value[1] ?? '' }
      : { field: condition.field, operator: condition.operator, value: value.join(', '), upper: '' };
  }
  return { field: condition.field, operator: condition.operator, value: value ?? '', upper: '' };
}

function conditionBody(draft: ConditionDraft) {
  const operator = draft.operator as Operator;
  if (isFlagOperator(operator)) return { field: draft.field, operator };
  if (operator === 'between')
    return { field: draft.field, operator, value: [draft.value.trim(), draft.upper.trim()] };
  if (operator === 'in' || operator === 'not_in')
    return { field: draft.field, operator, value: listOf(draft.value) };
  return { field: draft.field, operator, value: draft.value.trim() };
}

export function fromWorkflow(workflow: Workflow): WorkflowDraft {
  return {
    code: workflow.code,
    name: workflow.name,
    documentType: workflow.document_type,
    estateId: workflow.estate_id ?? '',
    effectiveFrom: workflow.effective_from,
    effectiveTo: workflow.effective_to,
    notes: workflow.notes ?? '',
    conditions: workflow.conditions.map(conditionDraft),
    steps: workflow.steps.map((step) => ({
      key: newKey(),
      name: step.name ?? '',
      rule: step.approver_rule,
      roleId: step.role_id ?? '',
      user: step.user ? { id: step.user.id, label: step.user.username } : null,
      level: String(step.reporting_level ?? 1),
      condition: step.condition ? conditionDraft(step.condition) : null,
      allowSelf: step.allow_self_approval,
    })),
  };
}

/** A step as the API takes it: only what its rule needs is sent. */
export function stepBody(step: StepDraft): StepBody {
  return {
    name: step.name.trim() === '' ? null : step.name.trim(),
    approver_rule: step.rule,
    role_id: step.rule === 'by_role' && step.roleId !== '' ? step.roleId : null,
    user_id: step.rule === 'by_named_user' ? (step.user?.id ?? null) : null,
    reporting_level: step.rule === 'by_reporting_line' ? Number.parseInt(step.level, 10) || null : null,
    condition: step.condition ? conditionBody(step.condition) : null,
    allow_self_approval: step.allowSelf,
  };
}

export function toBody(draft: WorkflowDraft): WorkflowBody {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    document_type: draft.documentType,
    estate_id: draft.estateId === '' ? null : draft.estateId,
    effective_from: draft.effectiveFrom ?? '',
    effective_to: draft.effectiveTo,
    conditions: draft.conditions.map(conditionBody),
    notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
    steps: draft.steps.map(stepBody),
  };
}

/** The field a condition tests, in the document type's own words (its name when the type is not known). */
export const fieldLabel = (type: DocumentType | undefined, name: string): string =>
  type?.fields.find((field) => field.name === name)?.label ?? name;

/** The value of a saved condition, as one line: "300,000.00", "A, B", "100 and 500". */
export function conditionValue(condition: Condition, and: string): string {
  const { value } = condition;
  if (value === null) return '';
  if (!Array.isArray(value)) return value;
  return condition.operator === 'between' ? value.join(` ${and} `) : value.join(', ');
}
