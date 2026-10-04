import { Link } from 'react-router';

import { config } from '@/lib/env';

import { type ScaffoldFact } from '../types';

const NEXT_STEPS = [
  'F0.03–F0.05 Component library',
  'F0.06 Data layer and API client',
  'F0.07 App shell, routing, auth shell and localisation',
];

/** Placeholder home page (F0.01, F0.02). The application shell (F0.07) replaces it. */
export function HomePage() {
  const facts: ScaffoldFact[] = [
    { label: 'Environment', value: config.mode },
    { label: 'API base URL', value: config.apiBaseUrl },
    { label: 'Milestone', value: 'F0.02 Design tokens, typography & breakpoints' },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <article className="w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <header className="flex items-center gap-4 bg-primary px-6 py-6 text-fg-on-primary sm:px-8">
          <img
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-lg bg-surface p-1.5"
          />
          <div>
            <h1 className="text-2xl font-bold">RupAI ERP</h1>
            <p className="text-sm text-fg-on-primary">Integrated Tea Estate ERP</p>
          </div>
        </header>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-subtle px-3 py-1 text-sm font-medium text-primary-strong">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
              <path d="M8.1 13.6 4.5 10l-1.4 1.4 5 5 9-9-1.4-1.4z" />
            </svg>
            Frontend scaffold is running
          </p>

          <dl className="divide-y divide-line rounded-lg border border-line">
            {facts.map((fact) => (
              <div key={fact.label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-fg-muted">{fact.label}</dt>
                <dd className="font-mono text-sm text-fg sm:col-span-2">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p>
            <Link
              to="/design/tokens"
              className="inline-flex min-h-(--size-touch-target) items-center font-medium text-primary underline underline-offset-4 hover:text-primary-hover md:min-h-0"
            >
              View the design tokens
            </Link>
          </p>

          <section aria-labelledby="next-steps">
            <h2 id="next-steps" className="mb-2 text-sm font-semibold text-fg">
              Coming next
            </h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-fg-muted">
              {NEXT_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </main>
  );
}

export { HomePage as Component };
