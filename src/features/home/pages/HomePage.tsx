import { config } from '@/lib/env';
import { describeMockSetting, mockSetting } from '@/lib/mocks';
import { Badge, Link } from '@/ui';

import { type ScaffoldFact } from '../types';

const NEXT_STEPS = [
  'F0.05 Data display, feedback and layout',
  'F0.06 Data layer and API client',
  'F0.07 App shell, routing, auth shell and localisation',
];

/** Placeholder home page (F0.01–F0.03). The application shell (F0.07) replaces it. */
export function HomePage() {
  const facts: ScaffoldFact[] = [
    { label: 'Environment', value: config.mode },
    { label: 'API base URL', value: config.apiBaseUrl },
    { label: 'Mocked APIs', value: describeMockSetting(mockSetting) },
    { label: 'Milestone', value: 'F0.04 Forms · P0.08 Backend connection' },
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
          <Badge tone="success" label="Frontend is running" />

          <dl className="divide-y divide-line rounded-lg border border-line">
            {facts.map((fact) => (
              <div key={fact.label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-fg-muted">{fact.label}</dt>
                <dd className="font-mono text-sm text-fg sm:col-span-2">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p>
            <Link href="/design/tokens" variant="standalone">
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
