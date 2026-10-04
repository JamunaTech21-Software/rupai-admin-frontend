import { Link } from 'react-router';

import {
  ALL_TOKENS,
  BREAKPOINT_TOKENS,
  COLOR_GROUPS,
  CONTRAST_PAIRS,
  FONT_TOKENS,
  MOTION_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SIZE_TOKENS,
  SPACING_TOKENS,
  TEXT_TOKENS,
  Z_INDEX_TOKENS,
} from '@/ui';

import { ColorSwatches } from '../components/ColorSwatches';
import { ContrastTable } from '../components/ContrastTable';
import { Section } from '../components/Section';
import { StateBadges } from '../components/StateBadges';
import { TokenTable } from '../components/TokenTable';
import { displayValue, useTokenValues } from '../components/useTokenValues';

const TOKEN_NAMES = ALL_TOKENS.map((token) => token.name);
const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];
const AMOUNTS = ['1,111.11', '88,888.80', '7,410.05', '120,000.00'];

/** The token reference (F0.02 verification): every token with its live value, and every contrast check. */
export function TokensPage() {
  const values = useTokenValues(TOKEN_NAMES);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <p>
          <Link to="/" className="text-primary underline underline-offset-4 hover:text-primary-hover">
            Home
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-fg">Design tokens</h1>
        <p className="max-w-3xl text-fg-muted">
          Every token, read live from the running stylesheet. Colours are named by role, never by appearance,
          and always come with a label. The palette is a placeholder taken from the RupAI dashboard until the
          designer delivers it (open item O-23).
        </p>
      </header>

      <Section id="colours" title="Colour">
        <div className="space-y-6">
          {COLOR_GROUPS.map((group) => (
            <ColorSwatches key={group.id} group={group} values={values} />
          ))}
        </div>
      </Section>

      <Section
        id="states"
        title="Document states"
        description="A state colour never stands alone: the badge always carries the state's name."
      >
        <StateBadges />
      </Section>

      <Section
        id="contrast"
        title="Contrast (WCAG AA)"
        description="Text needs 4.5:1; control borders and the focus ring need 3:1."
      >
        <ContrastTable pairs={CONTRAST_PAIRS} values={values} />
      </Section>

      <Section id="typography" title="Typography" description="Type scale ratio 1.200 from a 16 px base.">
        <TokenTable caption="Font tokens" tokens={FONT_TOKENS} values={values} />
        <div className="space-y-1 rounded-md bg-surface-subtle p-4">
          <p className="text-lg text-fg">Worker: Rahim Uddin · Estate: Rupacherra Tea Estate</p>
          <p className="text-lg text-fg" lang="bn">
            শ্রমিক: রহিম উদ্দিন · বাগান: রূপছড়া চা বাগান
          </p>
        </div>
        <ul className="space-y-3">
          {TEXT_TOKENS.map((token) => (
            <li key={token.name} className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:items-baseline sm:gap-4">
              <span className="font-mono text-sm text-fg-muted">
                {token.name} · {displayValue(values, token.name)}
              </span>
              <span
                className="text-fg"
                style={{ fontSize: `var(${token.name})`, lineHeight: `var(${token.name}--line-height)` }}
              >
                Plucked leaf 1,250.500 kg · পাতা তোলা
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold text-fg">Proportional figures</h3>
            <ul className="space-y-1 text-right text-lg text-fg">
              {AMOUNTS.map((amount) => (
                <li key={amount}>{amount}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-fg">
              Tabular figures (<code className="font-mono text-sm">figures</code>): money and quantity columns
            </h3>
            <ul className="space-y-1 text-right text-lg text-fg figures">
              {AMOUNTS.map((amount) => (
                <li key={amount}>{amount}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        id="spacing"
        title="Spacing"
        description="A 4 px grid. Utilities multiply the unit: p-4 is 16 px."
      >
        <TokenTable caption="Spacing token" tokens={SPACING_TOKENS} values={values} />
        <ul className="space-y-2">
          {SPACING_STEPS.map((step) => (
            <li key={step} className="flex items-center gap-3">
              <span className="w-28 shrink-0 font-mono text-sm text-fg-muted figures">
                {step} · {step * 4} px
              </span>
              <span
                aria-hidden="true"
                className="h-3 rounded-sm bg-primary"
                style={{ width: `calc(var(--spacing) * ${step})` }}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="radii-shadows" title="Radii and shadows">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {RADIUS_TOKENS.map((token) => (
            <li key={token.name} className="space-y-2 text-center">
              <span
                aria-hidden="true"
                className="mx-auto block size-16 border-2 border-primary bg-primary-subtle"
                style={{ borderRadius: `var(${token.name})` }}
              />
              <span className="block font-mono text-sm text-fg">{token.name}</span>
              <span className="block text-sm text-fg-muted">{token.use}</span>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-2 gap-6 pt-2 sm:grid-cols-4">
          {SHADOW_TOKENS.map((token) => (
            <li key={token.name} className="space-y-2 text-center">
              <span
                aria-hidden="true"
                className="mx-auto block h-16 w-full rounded-lg bg-surface"
                style={{ boxShadow: `var(${token.name})` }}
              />
              <span className="block font-mono text-sm text-fg">{token.name}</span>
              <span className="block text-sm text-fg-muted">{token.use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="breakpoints"
        title="Breakpoints"
        description="Mobile-first: styles start at base and add up."
      >
        <p className="font-medium text-fg">
          Current breakpoint: <span className="sm:hidden">base (below 640 px)</span>
          <span className="hidden sm:inline md:hidden">sm</span>
          <span className="hidden md:inline lg:hidden">md</span>
          <span className="hidden lg:inline xl:hidden">lg</span>
          <span className="hidden xl:inline">xl</span>
        </p>
        <TokenTable caption="Breakpoint tokens" tokens={BREAKPOINT_TOKENS} values={values} />
        <TokenTable caption="Size tokens" tokens={SIZE_TOKENS} values={values} />
      </Section>

      <Section id="layers-motion" title="Layers and motion">
        <TokenTable caption="Z-index layers" tokens={Z_INDEX_TOKENS} values={values} />
        <TokenTable caption="Motion tokens" tokens={MOTION_TOKENS} values={values} />
        <p className="text-sm text-fg-muted">
          Durations collapse to 0 ms when the operating system asks for reduced motion.
        </p>
      </Section>
    </main>
  );
}

export { TokensPage as Component };
