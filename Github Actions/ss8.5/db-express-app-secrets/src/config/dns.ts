import { setServers } from 'node:dns';

// This local network blocks public DNS (8.8.8.8, 1.1.1.1) on UDP+TCP:53.
// Only the ISP resolvers below answer, and they handle the SRV records that
// mongodb+srv:// requires. Force Node's resolver onto them.
//
// Imported first in server.ts so this runs before any module performs DNS.
//
// CI/cloud runners have working public DNS and the ISP resolvers are
// unreachable there, which would break the Atlas SRV lookup. Set
// SKIP_DNS_OVERRIDE=1 in those environments to keep the system resolver.
if (process.env.SKIP_DNS_OVERRIDE !== '1') {
  setServers(['213.57.2.5', '213.57.22.5']);
}
