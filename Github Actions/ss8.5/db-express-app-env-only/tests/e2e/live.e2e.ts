import { afterAll, describe, expect, test } from 'vitest';

// Hits a REAL running server process (npm start) backed by the real Atlas DB.
// No supertest / in-process app — every call goes over HTTP to BASE_URL.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Unique per run so parallel/repeat CI runs never collide on the unique email.
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `e2e-${stamp}@example.test`;

const createdIds: string[] = [];

const api = (path: string, init?: RequestInit) =>
  fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

afterAll(async () => {
  // Real DB — leave nothing behind even if assertions failed mid-suite.
  await Promise.all(
    createdIds.map((id) => api(`/api/users/${id}`, { method: 'DELETE' }).catch(() => undefined)),
  );
});

describe('Live server — health', () => {
  test('GET /livez', async () => {
    const res = await api('/livez');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('GET /readyz', async () => {
    const res = await api('/readyz');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ready' });
  });

  test('GET /status', async () => {
    const res = await api('/status');
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('port');
  });
});

describe('Live server — users CRUD over HTTP', () => {
  test('full lifecycle against real DB', async () => {
    const create = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E User', email }),
    });
    expect(create.status).toBe(201);
    const user = await create.json();
    expect(user).toMatchObject({ name: 'E2E User', email });
    createdIds.push(user.id);

    const get = await api(`/api/users/${user.id}`);
    expect(get.status).toBe(200);
    expect((await get.json()).id).toBe(user.id);

    const upd = await api(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'E2E Renamed' }),
    });
    expect(upd.status).toBe(200);
    expect((await upd.json()).name).toBe('E2E Renamed');

    const del = await api(`/api/users/${user.id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    createdIds.pop();

    const after = await api(`/api/users/${user.id}`);
    expect(after.status).toBe(404);
  });

  test('rejects invalid email (400)', async () => {
    const res = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', email: 'nope' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('ValidationError');
  });

  test('rejects duplicate email (409)', async () => {
    const dupEmail = `e2e-dup-${stamp}@example.test`;
    const first = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', email: dupEmail }),
    });
    expect(first.status).toBe(201);
    createdIds.push((await first.json()).id);

    const dup = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'B', email: dupEmail }),
    });
    expect(dup.status).toBe(409);
  });

  test('404 for unknown route', async () => {
    const res = await api('/api/nope');
    expect(res.status).toBe(404);
  });
});
