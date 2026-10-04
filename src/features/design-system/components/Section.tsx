import { type ReactNode } from 'react';

interface SectionProps {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-6"
    >
      <header className="space-y-1">
        <h2 id={id} className="text-xl font-semibold text-fg">
          {title}
        </h2>
        {description ? <p className="text-fg-muted">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
