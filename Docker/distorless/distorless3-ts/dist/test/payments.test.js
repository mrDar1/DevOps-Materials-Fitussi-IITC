"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const server_1 = __importDefault(require("../src/server"));
let server;
let base;
node_test_1.default.before(async () => {
    await new Promise((resolve) => {
        server = server_1.default.listen(0, () => {
            base = `http://localhost:${server.address().port}`;
            resolve();
        });
    });
});
node_test_1.default.after(() => server.close());
const post = (path, body) => fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
});
(0, node_test_1.default)('health returns ok', async () => {
    const res = await fetch(base + '/health');
    strict_1.default.equal(res.status, 200);
    const json = await res.json();
    strict_1.default.equal(json.status, 'ok');
});
(0, node_test_1.default)('create payment approved for even-ending card', async () => {
    const res = await post('/payments', { amount: 49.99, card: '4242424242424242' });
    strict_1.default.equal(res.status, 201);
    const json = await res.json();
    strict_1.default.equal(json.status, 'approved');
    strict_1.default.equal(json.cardLast4, '4242');
    strict_1.default.equal(json.currency, 'USD');
    strict_1.default.ok(json.id);
});
(0, node_test_1.default)('create payment declined for odd-ending card', async () => {
    const res = await post('/payments', { amount: 10, card: '4111111111111111' });
    strict_1.default.equal(res.status, 201);
    strict_1.default.equal((await res.json()).status, 'declined');
});
(0, node_test_1.default)('create rejects invalid amount', async () => {
    const res = await post('/payments', { amount: -5, card: '4242424242424242' });
    strict_1.default.equal(res.status, 400);
});
(0, node_test_1.default)('create rejects missing card', async () => {
    const res = await post('/payments', { amount: 5 });
    strict_1.default.equal(res.status, 400);
});
(0, node_test_1.default)('get payment by id', async () => {
    const created = await (await post('/payments', { amount: 20, card: '4000000000000002' })).json();
    const res = await fetch(`${base}/payments/${created.id}`);
    strict_1.default.equal(res.status, 200);
    strict_1.default.equal((await res.json()).id, created.id);
});
(0, node_test_1.default)('get unknown payment returns 404', async () => {
    const res = await fetch(base + '/payments/does-not-exist');
    strict_1.default.equal(res.status, 404);
});
(0, node_test_1.default)('list returns array', async () => {
    const res = await fetch(base + '/payments');
    strict_1.default.equal(res.status, 200);
    strict_1.default.ok(Array.isArray(await res.json()));
});
(0, node_test_1.default)('refund approved payment succeeds', async () => {
    const created = await (await post('/payments', { amount: 30, card: '4000000000000008' })).json();
    strict_1.default.equal(created.status, 'approved');
    const res = await post(`/payments/${created.id}/refund`);
    strict_1.default.equal(res.status, 200);
    const json = await res.json();
    strict_1.default.equal(json.status, 'refunded');
    strict_1.default.equal(json.refunded, true);
});
(0, node_test_1.default)('double refund rejected', async () => {
    const created = await (await post('/payments', { amount: 30, card: '4000000000000008' })).json();
    await post(`/payments/${created.id}/refund`);
    const res = await post(`/payments/${created.id}/refund`);
    strict_1.default.equal(res.status, 409);
});
(0, node_test_1.default)('refund declined payment rejected', async () => {
    const created = await (await post('/payments', { amount: 30, card: '4111111111111111' })).json();
    strict_1.default.equal(created.status, 'declined');
    const res = await post(`/payments/${created.id}/refund`);
    strict_1.default.equal(res.status, 409);
});
(0, node_test_1.default)('refund unknown payment returns 404', async () => {
    const res = await post('/payments/does-not-exist/refund');
    strict_1.default.equal(res.status, 404);
});
//# sourceMappingURL=payments.test.js.map