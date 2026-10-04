// @vitest-environment node
import path from 'node:path';

import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import rule from './import-boundaries.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.afterAll = afterAll;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
const file = (...parts) => path.join(process.cwd(), 'src', ...parts);

tester.run('import-boundaries', rule, {
  valid: [
    { filename: file('ui', 'Button.tsx'), code: "import { cx } from '@/lib/cx';" },
    { filename: file('features', 'payroll', 'pages', 'List.tsx'), code: "import { Button } from '@/ui';" },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { usePayslips } from '../api/hooks';",
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { workerRoutes } from '@/features/workforce';",
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { x } from '../../workforce';",
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { x } from '@/features/workforce/index';",
    },
    { filename: file('app', 'routes.ts'), code: "import { homeRoutes } from '@/features/home';" },
    { filename: file('app', 'routes.ts'), code: "import { RootLayout } from './RootLayout';" },
    {
      filename: file('features', 'home', 'index.ts'),
      code: "const page = () => import('./pages/HomePage');",
    },
    { filename: file('ui', 'Button.tsx'), code: "import React from 'react';" },
  ],
  invalid: [
    {
      filename: file('ui', 'Button.tsx'),
      code: "import { x } from '@/features/payroll';",
      errors: [{ messageId: 'forbiddenLayer' }],
    },
    {
      filename: file('ui', 'table', 'Table.tsx'),
      code: "import { x } from '../../features/payroll/api';",
      errors: [{ messageId: 'forbiddenLayer' }],
    },
    {
      filename: file('lib', 'api', 'client.ts'),
      code: "import { router } from '@/app/routes';",
      errors: [{ messageId: 'forbiddenLayer' }],
    },
    {
      filename: file('types', 'index.ts'),
      code: "import { config } from '@/lib/env';",
      errors: [{ messageId: 'forbiddenLayer' }],
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { WorkerCard } from '@/features/workforce/components/WorkerCard';",
      errors: [{ messageId: 'featureInternals' }],
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { useWorkers } from '../../workforce/api/hooks';",
      errors: [{ messageId: 'featureInternals' }],
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "export { x } from '@/features/workforce/types';",
      errors: [{ messageId: 'featureInternals' }],
    },
    {
      filename: file('app', 'routes.ts'),
      code: "const page = () => import('@/features/home/pages/HomePage');",
      errors: [{ messageId: 'featureInternals' }],
    },
    {
      filename: file('features', 'payroll', 'pages', 'List.tsx'),
      code: "import { routes } from '@/app/routes';",
      errors: [{ messageId: 'forbiddenLayer' }],
    },
  ],
});
