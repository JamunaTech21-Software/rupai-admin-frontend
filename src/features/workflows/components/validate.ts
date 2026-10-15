import { isFlagOperator, type WorkflowDraft } from './draft';

/** The editor's own messages, by the translation key under `editor` that says each. */
export type DraftProblem =
  | 'codeRequired'
  | 'nameRequired'
  | 'typeRequired'
  | 'fromRequired'
  | 'toBeforeFrom'
  | 'conditionIncomplete'
  | 'roleRequired'
  | 'userRequired';

const incomplete = (condition: WorkflowDraft['conditions'][number]): boolean =>
  condition.field === '' ||
  condition.operator === '' ||
  (!isFlagOperator(condition.operator) &&
    (condition.value.trim() === '' || (condition.operator === 'between' && condition.upper.trim() === '')));

/**
 * Everything wrong with a draft that can be seen without asking the server, by the field path the API uses
 * (`steps.1.role_id`), so the server's own messages and these land on the same controls. A new version keeps its
 * code and document type, so those are not checked.
 */
export function problemsOf(draft: WorkflowDraft, isVersion: boolean): Record<string, DraftProblem> {
  const found: Record<string, DraftProblem> = {};
  if (!isVersion && draft.code.trim() === '') found.code = 'codeRequired';
  if (draft.name.trim() === '') found.name = 'nameRequired';
  if (!isVersion && draft.documentType === '') found.document_type = 'typeRequired';
  if (!draft.effectiveFrom) found.effective_from = 'fromRequired';
  if (draft.effectiveFrom && draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom)
    found.effective_to = 'toBeforeFrom';
  draft.conditions.forEach((condition, index) => {
    if (incomplete(condition)) found[`conditions.${String(index)}`] = 'conditionIncomplete';
  });
  draft.steps.forEach((step, index) => {
    const at = `steps.${String(index)}`;
    if (step.rule === 'by_role' && step.roleId === '') found[`${at}.role_id`] = 'roleRequired';
    if (step.rule === 'by_named_user' && !step.user) found[`${at}.user_id`] = 'userRequired';
    if (step.condition && incomplete(step.condition)) found[`${at}.condition`] = 'conditionIncomplete';
  });
  return found;
}
