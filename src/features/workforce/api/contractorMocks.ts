import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import { Dec } from '@/lib/money';

import type { Contract, Contractor, ContractorSummary, Labour } from './contractors';

/**
 * MSW mocks of contractors, their contracts and labour (P2.05): the same addresses, bodies, `If-Match` rule and
 * refusals as the backend (422 DUPLICATE_KEY on a code; 409 on changing anything but a draft contract; a submitted
 * contract waits for an approval).
 */

const NOW = '2026-01-01T04:00:00.000Z';
const ESTATE = { id: 'e1', code: 'DEMO-A', name: 'Rupai Hills Tea Estate' };
const TRADE = { id: 'tc1', code: 'LABOUR_SUPPLY', name: 'Labour supply' };

interface Store {
  contractors: Contractor[];
  contracts: Contract[];
  labour: Labour[];
  sequence: number;
}
let store: Store = { contractors: [], contracts: [], labour: [], sequence: 100 };

function contract(id: string, contractorId: string, fields: Partial<Contract>): Contract {
  const contractor = store.contractors.find((c) => c.id === contractorId);
  return {
    id,
    contractor_id: contractorId,
    contractor: { id: contractorId, code: contractor?.code ?? '', name: contractor?.name ?? '' },
    estate_id: ESTATE.id,
    estate: ESTATE,
    contract_number: `CTR-${id.toUpperCase()}`,
    reference_number: null,
    work_type: 'labour_supply',
    rate_basis: 'per_day',
    rate: '550.0000',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    duration_months: 12,
    days_left: 67,
    contract_value: '1200000.0000',
    retention_percentage: null,
    payment_terms: 'monthly',
    work_location: 'estate',
    division_id: null,
    division: null,
    reporting_to_designation_id: null,
    reporting_to: null,
    terms: null,
    state: 'approved',
    status: 'active',
    approval_id: null,
    labour_count: 0,
    terminated_on: null,
    termination_reason: null,
    rejection_reason: null,
    version: 1,
    created_at: NOW,
    ...fields,
  };
}

function contractor(id: string, fields: Partial<Contractor> & Pick<Contractor, 'code' | 'name'>): Contractor {
  return {
    id,
    short_name: null,
    contractor_type: 'company',
    trade_category_id: TRADE.id,
    trade_category: TRADE,
    legal_status: null,
    registration_type: null,
    contractor_since: null,
    description: null,
    contact_person: 'Anwar Hossain',
    designation: 'Manager',
    phone: '+8801711000100',
    phone_alt: null,
    email: null,
    address_line1: 'Sreemangal',
    present_district: 'Moulvibazar',
    present_upazila: null,
    present_postal_code: null,
    permanent_address: null,
    permanent_district: null,
    permanent_upazila: null,
    permanent_postal_code: null,
    national_id: null,
    registration_number: null,
    trade_licence_number: 'TL-100',
    trade_licence_expiry: '2027-06-30',
    licence_expiring: false,
    bin: null,
    tin: null,
    vat_registration_number: null,
    registration_date: null,
    renewal_date: null,
    bank_name: 'Sonali Bank',
    bank_branch: 'Sreemangal',
    bank_account_name: fields.name,
    bank_account_number: '1000200030',
    bank_routing_number: null,
    mobile_banking_provider: null,
    mobile_banking_number: null,
    equipment_owned: null,
    years_of_experience: null,
    safety_compliance: null,
    quality_rating: null,
    remarks: null,
    emergency_contact_name: 'Rina Hossain',
    emergency_relation: 'spouse',
    emergency_phone: '+8801711000101',
    emergency_phone_alt: null,
    emergency_address: null,
    registered_estate_id: ESTATE.id,
    current_contract: null,
    number_of_workers: 0,
    status: 'active',
    blacklist_reason: null,
    version: 1,
    created_at: NOW,
    updated_at: null,
    ...fields,
  };
}

function fresh(): Store {
  store = { contractors: [], contracts: [], labour: [], sequence: 100 };
  store.contractors = [
    contractor('c1', { code: 'CON-0001', name: 'M/S Green Leaf Services' }),
    contractor('c2', {
      code: 'CON-0002',
      name: 'Rahim Electric',
      contractor_type: 'individual',
      status: 'active',
    }),
  ];
  store.contracts = [
    contract('k1', 'c1', { labour_count: 2 }),
    contract('k2', 'c2', { state: 'draft', status: 'pending', contract_value: '180000.0000' }),
  ];
  store.labour = [
    {
      id: 'l1',
      contractor_contract_id: 'k1',
      labour_code: 'L-0001',
      name: 'Abdul Karim',
      national_id: null,
      phone: null,
      engaged_from: null,
      engaged_to: null,
      status: 'active',
      version: 1,
    },
    {
      id: 'l2',
      contractor_contract_id: 'k1',
      labour_code: 'L-0002',
      name: 'Nurul Islam',
      national_id: null,
      phone: null,
      engaged_from: null,
      engaged_to: null,
      status: 'active',
      version: 1,
    },
  ];
  return store;
}

fresh();

/** Back to the starting contractors (tests call this in beforeEach). */
export function resetContractorMocks() {
  store = fresh();
}

const summaryOfContract = (k: Contract): NonNullable<Contractor['current_contract']> => ({
  id: k.id,
  contract_number: k.contract_number,
  estate: k.estate,
  work_type: k.work_type,
  start_date: k.start_date,
  end_date: k.end_date,
  contract_value: k.contract_value,
  work_location: k.work_location,
  division: k.division,
  status: k.status,
});

/** A contractor with the contract in force (else the latest) and the labour on it. */
function contractorOut(c: Contractor): Contractor {
  const mine = store.contracts.filter((k) => k.contractor_id === c.id);
  const current = mine.find((k) => k.status === 'active') ?? mine.at(-1);
  const workers = store.labour.filter(
    (l) =>
      l.status === 'active' && mine.some((k) => k.id === l.contractor_contract_id && k.status === 'active'),
  );
  return {
    ...c,
    current_contract: current ? summaryOfContract(current) : null,
    number_of_workers: workers.length,
  };
}

const contractOut = (k: Contract): Contract => ({
  ...k,
  labour_count: store.labour.filter((l) => l.contractor_contract_id === k.id).length,
});

const pct = (n: number, total: number) => (total === 0 ? '0.00' : ((n / total) * 100).toFixed(2));

function summaryOf(rows: readonly Contractor[]): ContractorSummary {
  const buckets = (key: (c: Contractor) => string) => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
    return [...counts].map(([k, count]) => ({
      key: k,
      label: k,
      count,
      percentage: pct(count, rows.length),
    }));
  };
  const active = rows.filter((c) => c.status === 'active');
  const value = store.contracts
    .filter((k) => k.status === 'active')
    .reduce((sum, k) => sum.plus(k.contract_value ?? '0'), new Dec(0));
  return {
    total: rows.length,
    active: active.length,
    inactive: rows.length - active.length,
    blacklisted: rows.filter((c) => c.status === 'blacklisted').length,
    contracts_expiring: 1,
    expiring_days: 30,
    new_this_month: 1,
    total_contract_value: value.toFixed(4),
    by_contractor_type: buckets((c) => c.contractor_type),
    by_work_type: buckets((c) => c.current_contract?.work_type ?? 'none'),
    by_trade_category: buckets((c) => c.trade_category?.name ?? 'none'),
    by_status: buckets((c) => c.status),
    top_contractors: [
      {
        contractor_id: 'c1',
        code: 'CON-0001',
        name: 'M/S Green Leaf Services',
        contract_value: '1200000.0000',
      },
    ],
    expiry_alerts: [
      {
        contract_id: 'k1',
        contract_number: 'CTR-K1',
        contractor_id: 'c1',
        contractor_name: 'M/S Green Leaf Services',
        end_date: '2026-11-20',
        days_left: 26,
        status: 'expiring_soon',
      },
    ],
    licences_expiring: 0,
  };
}

export function contractorMocks(b: string): RequestHandler[] {
  const findContractor = (id: unknown) => store.contractors.find((c) => c.id === id);
  const findContract = (id: unknown) => store.contracts.find((k) => k.id === id);
  const replaceContractor = (next: Contractor) => {
    store.contractors = store.contractors.map((c) => (c.id === next.id ? next : c));
    return next;
  };
  const replaceContract = (next: Contract) => {
    store.contracts = store.contracts.map((k) => (k.id === next.id ? next : k));
    return next;
  };
  const notFound = (what: string) => apiError(404, 'NOT_FOUND', `No such ${what}.`);
  const onlyDraft = () => apiError(409, 'INVALID_TRANSITION', 'Only a draft contract can be changed.');

  return [
    http.get(`${b}/contractors/summary`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return ok(summaryOf(store.contractors.map(contractorOut)));
    }),
    http.get(`${b}/contractors`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = store.contractors.map(contractorOut);
      for (const key of ['contractor_type', 'trade_category_id', 'status'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((c) => c[key] === wanted);
      }
      const q = url.searchParams.get('filter[q]')?.toLowerCase();
      if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
      const sort = url.searchParams.get('sort') ?? 'name';
      const key = sort.replace(/^-/, '');
      const text = (c: Contractor) => {
        const value = (c as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : '';
      };
      rows.sort((x, y) => text(x).localeCompare(text(y)) * (sort.startsWith('-') ? -1 : 1));
      return page(request, rows);
    }),
    http.post(`${b}/contractors`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Contractor> & {
        contact_person?: { contact_name: string };
        first_contract?: Partial<Contract>;
      };
      if (!body.contact_person?.contact_name)
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'contact_person.contact_name', code: 'REQUIRED', message: 'Contact person is required.' },
        ]);
      if (store.contractors.some((c) => c.code === body.code))
        return apiError(422, 'DUPLICATE_KEY', 'That code is already used.', [
          { field: 'code', code: 'DUPLICATE_KEY', message: 'Another contractor has this ID.' },
        ]);
      store.sequence += 1;
      const id = `c${String(store.sequence)}`;
      const { contact_person, first_contract, ...fields } = body;
      const made = contractor(id, {
        ...fields,
        code: body.code ?? `CON-${String(store.sequence).padStart(4, '0')}`,
        name: body.name ?? '',
        contact_person: contact_person.contact_name,
      });
      store.contractors.push(made);
      if (first_contract) {
        store.sequence += 1;
        store.contracts.push(
          contract(`k${String(store.sequence)}`, id, {
            ...first_contract,
            state: 'draft',
            status: 'pending',
          }),
        );
      }
      return created(contractorOut(made), `${b}/contractors/${id}`, made.version);
    }),
    http.get(`${b}/contractors/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = findContractor(params.id);
      return found ? ok(contractorOut(found), { version: found.version }) : notFound('contractor');
    }),
    http.put(`${b}/contractors/:id`, async ({ request, params }) => {
      const found = findContractor(params.id);
      if (!found) return notFound('contractor');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Contractor>;
      const next = replaceContractor({ ...found, ...body, version: found.version + 1, updated_at: NOW });
      return ok(contractorOut(next), { version: next.version });
    }),
    http.post(`${b}/contractors/:id/blacklist`, async ({ request, params }) => {
      const found = findContractor(params.id);
      if (!found) return notFound('contractor');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { reason?: string };
      if (!body.reason || body.reason.trim().length < 3)
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'reason', code: 'TOO_SHORT', message: 'Give a reason of at least 3 characters.' },
        ]);
      const next = replaceContractor({
        ...found,
        status: 'blacklisted',
        blacklist_reason: body.reason,
        version: found.version + 1,
      });
      return ok(contractorOut(next), { version: next.version });
    }),
    http.get(`${b}/contractors/:id/contracts`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return ok(
        store.contracts
          .filter((k) => k.contractor_id === params.id)
          .map(contractOut)
          .sort((x, y) => y.start_date.localeCompare(x.start_date)),
      );
    }),

    // ---- Contracts ----
    http.post(`${b}/contractor-contracts`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Contract> & { contractor_id: string };
      if (body.end_date && body.start_date && body.end_date < body.start_date)
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'end_date',
            code: 'BEFORE_START',
            message: 'The end date cannot be before the start date.',
          },
        ]);
      store.sequence += 1;
      const made = contract(`k${String(store.sequence)}`, body.contractor_id, {
        ...body,
        state: 'draft',
        status: 'pending',
      });
      store.contracts.push(made);
      return created(contractOut(made), `${b}/contractor-contracts/${made.id}`, made.version);
    }),
    http.patch(`${b}/contractor-contracts/:id`, async ({ request, params }) => {
      const found = findContract(params.id);
      if (!found) return notFound('contract');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const body = (await request.json()) as Partial<Contract>;
      const next = replaceContract({ ...found, ...body, version: found.version + 1 });
      return ok(contractOut(next), { version: next.version });
    }),
    http.delete(`${b}/contractor-contracts/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = findContract(params.id);
      if (found && found.state !== 'draft') return onlyDraft();
      store.contracts = store.contracts.filter((k) => k.id !== params.id);
      return noContent();
    }),
    http.post(`${b}/contractor-contracts/:id/submit`, ({ request, params }) => {
      const found = findContract(params.id);
      if (!found) return notFound('contract');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const next = replaceContract({
        ...found,
        state: 'submitted',
        status: 'pending',
        approval_id: 'ap-k',
        version: found.version + 1,
      });
      return ok(contractOut(next), { version: next.version });
    }),
    http.post(`${b}/contractor-contracts/:id/terminate`, async ({ request, params }) => {
      const found = findContract(params.id);
      if (!found) return notFound('contract');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { terminated_on: string; reason: string };
      if (found.state !== 'approved')
        return apiError(409, 'INVALID_TRANSITION', 'Only an approved contract can be terminated.');
      const next = replaceContract({
        ...found,
        state: 'terminated',
        status: 'terminated',
        terminated_on: body.terminated_on,
        termination_reason: body.reason,
        version: found.version + 1,
      });
      return ok(contractOut(next), { version: next.version });
    }),

    // ---- Labour ----
    http.get(`${b}/contractor-contracts/:id/labour`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return ok(store.labour.filter((l) => l.contractor_contract_id === params.id));
    }),
    http.post(`${b}/contractor-contracts/:id/labour`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Labour>;
      if (!body.name)
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'name', code: 'REQUIRED', message: 'Name is required.' },
        ]);
      store.sequence += 1;
      const count = store.labour.filter((l) => l.contractor_contract_id === params.id).length + 1;
      const made: Labour = {
        id: `l${String(store.sequence)}`,
        contractor_contract_id: String(params.id),
        labour_code: `L-${String(count).padStart(4, '0')}`,
        name: body.name,
        national_id: body.national_id ?? null,
        phone: body.phone ?? null,
        engaged_from: body.engaged_from ?? null,
        engaged_to: body.engaged_to ?? null,
        status: 'active',
        version: 1,
      };
      store.labour.push(made);
      return created(made, `${b}/contractor-contracts/${String(params.id)}/labour/${made.id}`, made.version);
    }),
    http.patch(`${b}/contractor-contracts/:id/labour/:labourId`, async ({ request, params }) => {
      const found = store.labour.find((l) => l.id === params.labourId);
      if (!found) return notFound('labourer');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Labour>;
      const next: Labour = { ...found, ...body, version: found.version + 1 };
      store.labour = store.labour.map((l) => (l.id === found.id ? next : l));
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/contractor-contracts/:id/labour/:labourId`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      store.labour = store.labour.filter((l) => l.id !== params.labourId);
      return noContent();
    }),
  ];
}
