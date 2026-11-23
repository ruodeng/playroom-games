import { DurableObject } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import { createServer } from 'node:http';
import template from '../dist/index.html';
import { SITE_ORIGIN } from '../src/site-pages.js';
import { isPublicAsset } from '../scripts/public-assets.mjs';
import { createRecordsApi } from '../scripts/records-api.mjs';
import { serveSiteRequest } from '../scripts/site-response.mjs';
import { sqliteRecordsPersistence } from './records-store.mjs';

// workerd uses this port as an in-isolate routing key. Each request carries the
// handler for its own Durable Object, so the bridge never retains object state.
const recordsPort = 8080;
createServer((request, response) => request.cloudflare.env.recordsApi(request, response)).listen(recordsPort);

const isRecordsApi = path => path === '/api/records' || path.startsWith('/api/records/');
const recordsObject = env => env.RECORDS.getByName('playroom-records');

function unavailable() {
  return Response.json({ error: '记录服务暂时不可用，请稍后重试' }, {
    status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function textError(request, status, message, extraHeaders = {}) {
  return new Response(request.method === 'HEAD' ? null : message, {
    status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extraHeaders },
  });
}

export class GameRecords extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.api = this.ctx.blockConcurrencyWhile(() => createRecordsApi({
      allowedOrigins: [SITE_ORIGIN], ...sqliteRecordsPersistence(ctx.storage),
    }));
  }

  async publicBoard(id) {
    return (await this.api).publicBoard(id);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.origin !== SITE_ORIGIN || !isRecordsApi(url.pathname)) return textError(request, 404, '未找到页面');
    const headers = new Headers(request.headers);
    headers.set('Host', url.host);
    // The entry Worker overwrites this private header with Cloudflare's visitor IP.
    headers.set('CF-Connecting-IP', headers.get('X-Playroom-Client-IP') || 'unknown');
    headers.delete('X-Playroom-Client-IP');
    return handleAsNodeRequest(recordsPort, new Request(request, { headers }), { recordsApi: await this.api });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = request.headers.get('Host');
    if (host && host.toLowerCase() !== url.host) return textError(request, 404, '未找到页面');
    const api = isRecordsApi(url.pathname);
    if (url.origin !== SITE_ORIGIN) {
      if (url.origin === SITE_ORIGIN.replace('https:', 'http:') && !api && ['GET', 'HEAD'].includes(request.method)) {
        return Response.redirect(SITE_ORIGIN + url.pathname + url.search, 308);
      }
      return textError(request, 404, '未找到页面');
    }
    if (api) {
      try {
        const headers = new Headers(request.headers);
        headers.set('X-Playroom-Client-IP', headers.get('CF-Connecting-IP') || 'unknown');
        return await recordsObject(env).fetch(new Request(request, { headers }));
      } catch { return unavailable(); }
    }
    try {
      const document = await serveSiteRequest(request, {
        template, records: { publicBoard: id => recordsObject(env).publicBoard(id) },
        gaMeasurementId: env.GA_MEASUREMENT_ID, verificationToken: env.GOOGLE_SITE_VERIFICATION,
      });
      if (document) return document;
      if (!isPublicAsset(url.pathname)) return textError(request, 404, '未找到页面');
      if (!['GET', 'HEAD'].includes(request.method)) return textError(request, 405, '不支持该请求方法', { Allow: 'GET, HEAD' });
      return await env.ASSETS.fetch(request);
    } catch {
      return textError(request, 503, '页面暂时不可用，请稍后重试');
    }
  },
};
