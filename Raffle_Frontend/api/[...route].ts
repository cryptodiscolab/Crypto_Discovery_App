/**
 * CATCH-ALL API ROUTE
 * Consolidates all API endpoints into a single serverless function
 * to stay within Vercel Hobby plan's 12-function limit.
 *
 * All routes defined in vercel.json rewrites are handled here.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Re-export all handlers ───────────────────────────────────────────────────
export { default as auditBundle } from './_audit-bundle.js';
export { default as adminBundle } from './_admin-bundle.js';
export { default as userBundle } from './_user-bundle.js';
export { default as tasksBundle } from './_tasks-bundle.js';
export { default as raffleBundle } from './_raffle-bundle.js';
export { default as raffleSync } from './_raffle-sync.js';
export { default as syncXpOnchain } from './_sync-xp-onchain.js';
export { default as lurahCron } from './_lurah-cron.js';
export { default as notifyHandler } from './_notify.js';
export { default as pinMetadata } from './_pin-metadata.js';
export { default as isAdmin } from './_is-admin.js';
export { default as pingHandler } from './_ping.js';
export { default as backupHandler } from './cron/_backup.js';

// ── Route Map ────────────────────────────────────────────────────────────────
type RouteHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

const routes: Record<string, RouteHandler> = {
  // Bundle routes with action query param routing — the bundles dispatch internally
  'audit-bundle':            (req, res) => import('./_audit-bundle.js').then(m => m.default(req, res)),
  'admin-bundle':            (req, res) => import('./_admin-bundle.js').then(m => m.default(req, res)),
  'user-bundle':             (req, res) => import('./_user-bundle.js').then(m => m.default(req, res)),
  'tasks-bundle':            (req, res) => import('./_tasks-bundle.js').then(m => m.default(req, res)),
  'raffle-bundle':           (req, res) => import('./_raffle-bundle.js').then(m => m.default(req, res)),

  // Standalone endpoints
  'raffle-sync':             (req, res) => import('./_raffle-sync.js').then(m => m.default(req, res)),
  'sync-xp-onchain':         (req, res) => import('./_sync-xp-onchain.js').then(m => m.default(req, res)),
  'lurah-cron':              (req, res) => import('./_lurah-cron.js').then(m => m.default(req, res)),
  'notify':                  (req, res) => import('./_notify.js').then(m => m.default(req, res)),
  'pin-metadata':            (req, res) => import('./_pin-metadata.js').then(m => m.default(req, res)),
  'is-admin':                (req, res) => import('./_is-admin.js').then(m => m.default(req, res)),
  'ping':                    (req, res) => import('./_ping.js').then(m => m.default(req, res)),
  'cron/backup':             (req, res) => import('./cron/_backup.js').then(m => m.default(req, res)),
  'cron/sync-events':        (req, res) => import('./_audit-bundle.js').then(m => {
    req.query = { ...req.query, action: 'sync' };
    return m.default(req, res);
  }),
  'cron/reconcile-pending':  (req, res) => import('./_audit-bundle.js').then(m => {
    req.query = { ...req.query, action: 'reconcile-pending' };
    return m.default(req, res);
  }),
  'rpc':                     (req, res) => import('./_audit-bundle.js').then(m => {
    req.query = { ...req.query, action: 'rpc' };
    return m.default(req, res);
  }),
};

// ── Catch-All Handler ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the route from the URL: /api/xxx -> xxx, /api/cron/xxx -> cron/xxx
  const urlPath = (req.url || '').split('?')[0];
  const apiPath = urlPath.replace(/^\/api\//, '').replace(/\/$/, '');

  // Try exact match first, then check if it starts with a bundle prefix
  if (routes[apiPath]) {
    return routes[apiPath](req, res);
  }

  // Handle dynamic routes: /api/user/:action, /api/raffle/:action, /api/tasks/:action, etc.
  const pathParts = apiPath.split('/');

  if (pathParts[0] === 'user' && pathParts[1]) {
    req.query = { ...req.query, action: pathParts[1] };
    return routes['user-bundle'](req, res);
  }

  if (pathParts[0] === 'farcaster' && pathParts[1]) {
    req.query = { ...req.query, action: `fc-${pathParts[1]}` };
    return routes['user-bundle'](req, res);
  }

  if (pathParts[0] === 'raffle' && pathParts[1]) {
    req.query = { ...req.query, action: pathParts[1] };
    return routes['raffle-bundle'](req, res);
  }

  if (pathParts[0] === 'tasks' && pathParts[1]) {
    req.query = { ...req.query, action: pathParts[1] };
    return routes['tasks-bundle'](req, res);
  }

  if (pathParts[0] === 'admin' && pathParts[1]) {
    // admin/system/update -> handled by admin-bundle without action
    if (pathParts[1] === 'system' && pathParts[2] === 'update') {
      req.query = { ...req.query, action: 'system-update' };
    } else {
      req.query = { ...req.query, action: pathParts[1] };
    }
    return routes['admin-bundle'](req, res);
  }

  if (apiPath === 'leaderboard') {
    req.query = { ...req.query, action: 'leaderboard' };
    return routes['user-bundle'](req, res);
  }

  if (apiPath === 'verify-action') {
    req.query = { ...req.query, action: 'social-verify' };
    return routes['tasks-bundle'](req, res);
  }

  if (apiPath === 'farcaster-check') {
    req.query = { ...req.query, action: 'check' };
    return routes['audit-bundle'](req, res);
  }

  // 404 for unknown routes
  return res.status(404).json({ error: `Route not found: ${apiPath}` });
}