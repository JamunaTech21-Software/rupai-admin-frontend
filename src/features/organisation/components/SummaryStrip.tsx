import { Card, cx, StatCard } from '@/ui';

/** A card of figures under a list, as the design's summaries ("Division & Section Summary"). */
export function SummaryStrip({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly { readonly label: string; readonly value: string; readonly unit?: string }[];
}) {
  return (
    <Card title={title} headingLevel={2}>
      <div
        className={cx(
          'grid grid-cols-2 gap-3 md:grid-cols-3',
          items.length % 5 === 0 ? 'xl:grid-cols-5' : 'xl:grid-cols-6',
        )}
      >
        {items.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            {...(item.unit ? { unit: item.unit } : {})}
          />
        ))}
      </div>
    </Card>
  );
}
