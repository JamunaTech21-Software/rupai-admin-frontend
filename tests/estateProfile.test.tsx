import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import {
  MOCK_AMENITIES,
  MOCK_PHOTOGRAPH_TYPE,
  organisationMocks,
  resetOrganisationMocks,
} from '@/features/organisation/api/mocks';
import { setAccessToken } from '@/lib/api';
import { authMocks, MOCK_PASSWORD, resetMockSession } from '@/lib/mocking/contract';

import { axeViolations } from './axe';
import { server } from './msw/server';

/** R.2 (RUP-586): the Estate Profile. */

const BASE = 'http://localhost/api/v1';
const row = (r: { id: string; code: string; name: string }) => ({ ...r, status: 'active', version: 1 });

beforeEach(() => {
  resetMockSession();
  resetOrganisationMocks();
  setAccessToken(null);
  server.use(
    ...authMocks(BASE),
    ...organisationMocks(BASE),
    // The selection lists the profile reads: facilities, the Photograph type and countries.
    http.get(`${BASE}/lookups`, () =>
      HttpResponse.json({
        data: {
          amenity: MOCK_AMENITIES.map(row),
          document_type: [row(MOCK_PHOTOGRAPH_TYPE)],
          country: [row({ id: 'co_bd', code: 'BD', name: 'Bangladesh' })],
        },
        meta: { request_id: 'test' },
      }),
    ),
  );
});

let appRoot: HTMLElement = document.body;

async function openProfile(path = '/estates/e1') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  appRoot = render(<RouterProvider router={router} />).container;
  await userEvent.type(await screen.findByRole('textbox', { name: /Username/ }), 'manager');
  await userEvent.type(screen.getByLabelText(/^Password/), MOCK_PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { level: 1, name: 'Rupai Hills Tea Estate' });
  return router;
}

const card = (name: string) => screen.findByRole('region', { name });

describe('estate profile', () => {
  it('shows the profile cards, the tab bar and the key people', async () => {
    await openProfile();
    const tabs = screen.getByRole('navigation', { name: 'Estate management' });
    expect(within(tabs).getByRole('link', { name: '1. Estate Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: '2. Division & Section' })).toHaveAttribute(
      'href',
      '/estates/e1/divisions',
    );
    expect(within(tabs).getByRole('link', { name: '3. Field / Block' })).toHaveAttribute(
      'href',
      '/estates/e1/fields',
    );
    for (const name of [
      'Estate Basic Information',
      'Manager / In-charge Information',
      'Facilities / Amenities',
      'Estate Images',
      'Estate Overview',
      'Estate Summary',
      'Geo Location',
      'Description / Note',
    ]) {
      expect(await card(name)).toBeInTheDocument();
    }
    const managers = await card('Manager / In-charge Information');
    const estateManager = within(managers).getByRole('group', { name: 'Estate Manager' });
    expect(within(estateManager).getByRole('textbox', { name: 'Name' })).toHaveValue('Abdul Karim');
    // Workers and families come with HR.
    const overview = await card('Estate Overview');
    expect(within(overview).getAllByText('Available with HR')).toHaveLength(2);
    expect(await axeViolations(appRoot)).toEqual([]);
  });

  it('shows the computed figures as the prompt, and non-tea area follows what is typed', async () => {
    await openProfile();
    const overview = await card('Estate Overview');
    const box = (name: RegExp) => within(overview).getByRole('textbox', { name });
    // Nothing entered: the records' figures are the prompts, and each says it is automatic.
    await waitFor(() => {
      expect(box(/Tea area/)).toHaveAttribute('placeholder', '28.75');
    });
    expect(within(overview).getAllByText('Auto').length).toBeGreaterThanOrEqual(5);
    // Tea area is 28.750 acres from the fields; 40 declared leaves 11.25 outside tea, until it is typed.
    await userEvent.type(box(/Total land area/), '40');
    await waitFor(() => {
      expect(box(/Non-tea area/)).toHaveAttribute('placeholder', '11.25');
    });
    // Typing tea area moves it live; the records are still said beside it.
    await userEvent.type(box(/Tea area/), '30');
    await waitFor(() => {
      expect(box(/Non-tea area/)).toHaveAttribute('placeholder', '10.00');
    });
    expect(within(overview).getByText('Records: 28.75')).toBeInTheDocument();
    // A total smaller than the tea area never goes below zero.
    await userEvent.clear(box(/Total land area/));
    await userEvent.type(box(/Total land area/), '10');
    await waitFor(() => {
      expect(box(/Non-tea area/)).toHaveAttribute('placeholder', '0.00');
    });
    // Clearing a figure goes back to the computed one.
    await userEvent.clear(box(/Tea area/));
    await waitFor(() => {
      expect(box(/Tea area/)).toHaveValue('');
    });
    expect(within(overview).queryByText('Records: 28.75')).not.toBeInTheDocument();
  }, 60_000);

  it('saves the entered figures with the profile, and refuses tea area above the total', async () => {
    await openProfile();
    const overview = await card('Estate Overview');
    const box = (name: RegExp) => within(overview).getByRole('textbox', { name });
    await userEvent.type(box(/Total land area/), '40');
    await userEvent.type(box(/Tea area/), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(overview).findByText('Cannot be more than the total land area.')).toBeInTheDocument();

    await userEvent.clear(box(/Tea area/));
    await userEvent.type(box(/Tea area/), '30');
    await userEvent.type(within(overview).getByRole('textbox', { name: /Total division/ }), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Estate profile saved')).toBeInTheDocument();

    // Read back after the reload the save causes: what was entered is kept, and the records are still said.
    const again = await card('Estate Overview');
    await waitFor(() => {
      expect(within(again).getByRole('textbox', { name: /Total division/ })).toHaveValue('9');
    });
    expect(within(again).getByText('Records: 2')).toBeInTheDocument();
    expect(within(again).getByText('Records: 28.75')).toBeInTheDocument();
  }, 90_000);

  it('saves the basic information, facilities and a new assistant manager with one Save', async () => {
    await openProfile();
    const basic = await card('Estate Basic Information');
    await userEvent.type(within(basic).getByRole('textbox', { name: 'Company / owner' }), 'Rupai Tea Co.');
    await userEvent.type(within(basic).getByRole('textbox', { name: 'Police station' }), 'Sreemangal');

    const facilities = await card('Facilities / Amenities');
    await userEvent.click(await within(facilities).findByRole('checkbox', { name: 'School' }));

    const managers = await card('Manager / In-charge Information');
    const assistant = within(managers).getByRole('group', { name: 'Assistant Manager' });
    await userEvent.type(within(assistant).getByRole('textbox', { name: 'Name' }), 'Rina Das');
    await userEvent.type(within(assistant).getByRole('textbox', { name: 'Mobile' }), '+8801711000011');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Estate profile saved')).toBeInTheDocument();

    // Read back after the reload the save causes.
    const reloaded = await card('Manager / In-charge Information');
    const again = within(reloaded).getByRole('group', { name: 'Assistant Manager' });
    expect(await within(again).findByDisplayValue('Rina Das')).toBeInTheDocument();
    expect(
      within(await card('Facilities / Amenities')).getByRole('checkbox', { name: 'School' }),
    ).toBeChecked();
    expect(
      within(await card('Estate Basic Information')).getByRole('textbox', { name: 'Company / owner' }),
    ).toHaveValue('Rupai Tea Co.');
    // Many fields are typed one key at a time, which is slow on a busy machine.
  }, 60_000);

  it('checks coordinates, the website and a key person without a name', async () => {
    await openProfile();
    const geo = await card('Geo Location');
    await userEvent.type(within(geo).getByRole('textbox', { name: 'Latitude' }), '24.31');
    const basic = await card('Estate Basic Information');
    await userEvent.type(within(basic).getByRole('textbox', { name: 'Website' }), 'rupai.example');
    const managers = await card('Manager / In-charge Information');
    const assistant = within(managers).getByRole('group', { name: 'Assistant Manager' });
    await userEvent.type(within(assistant).getByRole('textbox', { name: 'Mobile' }), '+8801711000000');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter both latitude and longitude, or neither.')).toBeInTheDocument();
    expect(screen.getByText('Enter a web address starting with http:// or https://.')).toBeInTheDocument();
    expect(screen.getByText('Enter the name, or clear the other fields.')).toBeInTheDocument();

    await userEvent.type(within(geo).getByRole('textbox', { name: 'Longitude' }), '200');
    await userEvent.tab();
    expect(await screen.findByText('Enter a longitude between -180 and 180.')).toBeInTheDocument();
  }, 60_000);

  it('Reset puts back what was saved', async () => {
    await openProfile();
    const basic = await card('Estate Basic Information');
    const district = within(basic).getByRole('textbox', { name: 'District' });
    await userEvent.clear(district);
    await userEvent.type(district, 'Sylhet');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(district).toHaveValue('Moulvibazar');
  });

  it('adds a photo to the gallery and removes one', async () => {
    await openProfile();
    const images = await card('Estate Images');
    expect(
      await within(images).findByRole('img', { name: 'Tea garden · Rupai Hills Tea Estate' }),
    ).toBeInTheDocument();

    // jsdom's FormData cannot travel through Node's fetch, so the upload itself is answered here; the form the
    // app builds is what is checked. Every other request goes on to the mocks.
    const sent: { form: FormData | null } = { form: null };
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (init?.body instanceof FormData) {
        sent.form = init.body;
        const photo = {
          id: 'doc_up',
          title: 'Main gate',
          file_name: 'gate.png',
          mime_type: 'image/png',
          document_type: MOCK_PHOTOGRAPH_TYPE,
          version: 1,
        };
        return Promise.resolve(Response.json({ data: photo, meta: { request_id: 'test' } }, { status: 201 }));
      }
      return realFetch(input, init);
    });

    const file = new File(['png'], 'gate.png', { type: 'image/png' });
    // FileTrigger's input is hidden; the visible button opens it.
    const input = images.querySelector('input[type=file]');
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input');
    await userEvent.upload(input, file);
    await userEvent.click(within(images).getByRole('button', { name: /What it shows/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Main gate' }));
    await userEvent.click(within(images).getByRole('button', { name: 'Add photo' }));
    expect(await screen.findByText('Photo added')).toBeInTheDocument();
    spy.mockRestore();
    expect(sent.form?.get('document_type_id')).toBe(MOCK_PHOTOGRAPH_TYPE.id);
    expect(sent.form?.get('title')).toBe('Main gate');
    expect((sent.form?.get('file') as File | null)?.name).toBe('gate.png');

    await userEvent.click(within(images).getByRole('button', { name: 'Remove photo: Tea garden' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove this photo?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove photo' }));
    expect(await screen.findByText('Photo removed')).toBeInTheDocument();
    expect(
      within(images).queryByRole('img', { name: 'Tea garden · Rupai Hills Tea Estate' }),
    ).not.toBeInTheDocument();
  });
});
