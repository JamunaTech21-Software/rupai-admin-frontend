import { useTranslation } from '@/lib/i18n';
import { AsyncCombobox, Button, Card, Checkbox, IconButton, Input, Select } from '@/ui';

import { findUsers } from '../api/users';
import { APPROVER_RULES, type DocumentType, MAX_REPORTING_LEVEL, MAX_STEPS } from '../api/workflows';
import { AddConditionButton, ConditionEditor } from './ConditionEditor';
import { blankCondition, blankStep, type StepDraft } from './draft';

const LEVELS = Array.from({ length: MAX_REPORTING_LEVEL }, (_, index) => String(index + 1));

/**
 * The steps of a workflow, in order (the first is step 1): each says who approves (a role, someone up the reporting
 * line, a named person, the cost-centre manager), may carry a condition that decides whether it applies, and may
 * allow self-approval where the document type permits it. The server's messages for a step (`steps.2.condition`)
 * are shown on that step.
 */
export function StepsEditor({
  steps,
  documentType,
  roles,
  errors,
  onChange,
}: {
  readonly steps: readonly StepDraft[];
  readonly documentType: DocumentType | undefined;
  readonly roles: readonly { id: string; name: string }[];
  /** Server messages by field path: `steps.0.condition`. */
  readonly errors: Readonly<Record<string, string>>;
  readonly onChange: (steps: StepDraft[]) => void;
}) {
  const { t } = useTranslation('workflows');
  const fields = documentType?.fields ?? [];

  const update = (index: number, patch: Partial<StepDraft>) => {
    onChange(steps.map((step, at) => (at === index ? { ...step, ...patch } : step)));
  };
  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    const [taken] = next.splice(index, 1);
    if (taken) next.splice(index + by, 0, taken);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, index) => {
        const number = index + 1;
        const name = t('editor.stepName', { number });
        const problems = Object.entries(errors)
          .filter(([path]) => path === `steps.${String(index)}` || path.startsWith(`steps.${String(index)}.`))
          .map(([, message]) => message);
        return (
          <Card key={step.key} title={name} headingLevel={3}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-end gap-1">
                <IconButton
                  icon="chevronUp"
                  variant="ghost"
                  size="sm"
                  label={t('editor.moveUp', { number })}
                  isDisabled={index === 0}
                  onPress={() => {
                    move(index, -1);
                  }}
                />
                <IconButton
                  icon="chevronDown"
                  variant="ghost"
                  size="sm"
                  label={t('editor.moveDown', { number })}
                  isDisabled={index === steps.length - 1}
                  onPress={() => {
                    move(index, 1);
                  }}
                />
                <IconButton
                  icon="trash"
                  variant="ghost"
                  size="sm"
                  label={t('editor.removeStep', { number })}
                  isDisabled={steps.length === 1}
                  onPress={() => {
                    onChange(steps.filter((_, at) => at !== index));
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={t('editor.purpose', { number })}
                  hint={t('editor.purposeHint')}
                  value={step.name}
                  maxLength={100}
                  onChange={(value) => {
                    update(index, { name: value });
                  }}
                />
                <Select
                  label={t('editor.rule', { number })}
                  value={step.rule}
                  options={APPROVER_RULES.map((rule) => ({ id: rule, label: t(`rules.${rule}`) }))}
                  onChange={(value) => {
                    const rule = APPROVER_RULES.find((candidate) => candidate === value);
                    if (rule) update(index, { rule });
                  }}
                />
                {step.rule === 'by_role' ? (
                  <Select
                    label={t('editor.role', { number })}
                    isRequired
                    value={step.roleId === '' ? null : step.roleId}
                    options={roles.map((role) => ({ id: role.id, label: role.name }))}
                    onChange={(value) => {
                      update(index, { roleId: value ?? '' });
                    }}
                  />
                ) : null}
                {step.rule === 'by_named_user' ? (
                  <AsyncCombobox
                    label={t('editor.user', { number })}
                    isRequired
                    value={step.user}
                    onChange={(value) => {
                      update(index, { user: value });
                    }}
                    loadOptions={async ({ query, signal }) => ({ items: await findUsers(query, signal) })}
                  />
                ) : null}
                {step.rule === 'by_reporting_line' ? (
                  <Select
                    label={t('editor.level', { number })}
                    hint={t('editor.levelHint')}
                    value={step.level}
                    options={LEVELS.map((level) => ({
                      id: level,
                      label: t('editor.levelOption', { level }),
                    }))}
                    onChange={(value) => {
                      update(index, { level: value ?? '1' });
                    }}
                  />
                ) : null}
              </div>
              {documentType?.self_approval_configurable ? (
                <Checkbox
                  isSelected={step.allowSelf}
                  onChange={(on) => {
                    update(index, { allowSelf: on });
                  }}
                >
                  {t('editor.allowSelf', { number })}
                </Checkbox>
              ) : null}
              {step.condition ? (
                <ConditionEditor
                  condition={step.condition}
                  fields={fields}
                  label={t('editor.stepCondition', { number })}
                  onChange={(condition) => {
                    update(index, { condition });
                  }}
                  onRemove={() => {
                    update(index, { condition: null });
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <AddConditionButton
                    label={t('editor.addStepCondition', { number })}
                    onPress={() => {
                      update(index, { condition: blankCondition() });
                    }}
                  />
                  <span className="text-sm text-fg-muted">{t('editor.alwaysApplies')}</span>
                </div>
              )}
              {problems.length > 0 ? (
                <ul role="alert" className="list-disc ps-5 text-sm text-danger">
                  {problems.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>
        );
      })}
      <div>
        <Button
          variant="secondary"
          iconStart="plus"
          isDisabled={steps.length >= MAX_STEPS}
          onPress={() => {
            onChange([...steps, blankStep()]);
          }}
        >
          {t('editor.addStep')}
        </Button>
      </div>
    </div>
  );
}
