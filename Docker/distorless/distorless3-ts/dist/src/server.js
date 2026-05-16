"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payments_1 = __importDefault(require("./routes/payments"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});
app.use('/payments', payments_1.default);
// 404
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});
// Only bind a port when run directly, not when imported by tests.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Dummy payment system listening on http://localhost:${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map