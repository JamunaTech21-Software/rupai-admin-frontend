import { type Key } from 'react';
import { Button, Collection, Tree as AriaTree, TreeItem, TreeItemContent } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  /** A second detail: a code, a count ("12 sections"). */
  readonly description?: string;
  readonly children?: readonly TreeNode[];
}

export interface TreeProps {
  /** The tree's accessible name: "Estate hierarchy". */
  readonly label: string;
  readonly items: readonly TreeNode[];
  /** `single` lets one node be chosen (a scope picker); `none` is for browsing. */
  readonly selectionMode?: 'none' | 'single';
  readonly selectedKey?: string | null;
  readonly onSelectionChange?: (key: string | null) => void;
  /** Called when a node is activated (Enter or click) in browse mode: open that estate, division… */
  readonly onAction?: (key: string) => void;
  readonly defaultExpandedKeys?: readonly string[];
  readonly className?: string;
}

function renderNode(node: TreeNode) {
  return (
    <TreeItem
      key={node.id}
      id={node.id}
      textValue={node.label}
      className={cx(
        'cursor-default rounded-sm text-fg outline-none',
        'data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus',
        'data-hovered:bg-surface-subtle',
        'data-selected:bg-primary-subtle data-selected:text-primary-strong',
      )}
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded, level }) => (
          <div
            className="flex min-h-(--size-touch-target) items-center gap-1 pe-2 md:min-h-9"
            style={{ paddingInlineStart: `${(level - 1) * 1.25 + 0.25}rem` }}
          >
            {hasChildItems ? (
              <Button
                slot="chevron"
                className="flex size-7 shrink-0 items-center justify-center rounded-sm text-fg-muted data-hovered:bg-surface-subtle"
              >
                <Icon
                  name="chevronRight"
                  size="sm"
                  className={cx(
                    'transition-transform motion-reduce:transition-none',
                    isExpanded && 'rotate-90',
                  )}
                />
              </Button>
            ) : (
              <span className="size-7 shrink-0" />
            )}
            <span className="flex-1 truncate">{node.label}</span>
            {node.description ? (
              <span className="shrink-0 text-sm text-fg-muted">{node.description}</span>
            ) : null}
          </div>
        )}
      </TreeItemContent>
      {node.children ? <Collection items={node.children}>{renderNode}</Collection> : null}
    </TreeItem>
  );
}

/**
 * A hierarchy to browse or pick from: estate › division › section › field. Arrow keys move, Right/Left open
 * and close a branch, typing jumps to a name.
 */
export function Tree({
  label,
  items,
  selectionMode = 'none',
  selectedKey,
  onSelectionChange,
  onAction,
  defaultExpandedKeys = [],
  className,
}: TreeProps) {
  return (
    <AriaTree
      aria-label={label}
      items={items}
      selectionMode={selectionMode}
      {...(selectionMode === 'single'
        ? {
            disallowEmptySelection: false,
            ...(selectedKey !== undefined ? { selectedKeys: selectedKey ? [selectedKey] : [] } : {}),
            onSelectionChange: (keys: 'all' | Set<Key>) => {
              if (keys === 'all') return;
              const [first] = [...keys];
              onSelectionChange?.(first === undefined ? null : String(first));
            },
          }
        : {})}
      {...(onAction
        ? {
            onAction: (key: Key) => {
              onAction(String(key));
            },
          }
        : {})}
      defaultExpandedKeys={[...defaultExpandedKeys]}
      className={cx('flex flex-col rounded-lg border border-line bg-surface p-1', className)}
    >
      {renderNode}
    </AriaTree>
  );
}
