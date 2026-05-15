#!/usr/bin/env node
/**
 * API Route Contract Test
 *
 * Extracts every `/api/...` string literal used by the frontend (src/) and
 * validates that each path can be resolved by either:
 *   1. A direct file in api/*.ts (e.g. /api/user-bundle -> api/user-bundle.ts)
 *   2. A rewrite rule in vercel.json (e.g. /api/user/:action -> /api/user-bundle?action=:action)
 *
 * Exits with code 1 if any frontend route does not have a matching backend handler.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const API_DIR = path.join(ROOT, 'api');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

function walk(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, files);
        else if (/\.(t|j)sx?$/.test(entry.name)) files.push(full);
    }
    return files;
}

function extractApiPaths(content) {
    // Match string literals that start with /api/ inside fetch / axios / direct calls.
    // Captures both single and double quoted strings, plus template literals without interpolation.
    const paths = new Set();
    const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    // Match '...'  "..." or `...` (template literals without ${})
    const regex = /(['"`])(\/api\/[^'"`\s${]+)\1/g;
    let m;
    while ((m = regex.exec(withoutComments)) !== null) {
        let p = m[2];
        // Strip query strings
        p = p.split('?')[0];
        // Strip trailing slashes
        p = p.replace(/\/$/, '');
        if (p.startsWith('/api/')) paths.add(p);
    }
    return [...paths];
}

function loadVercelRewrites() {
    if (!fs.existsSync(VERCEL_JSON)) return [];
    const content = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'));
    return content.rewrites || [];
}

function listApiFiles() {
    if (!fs.existsSync(API_DIR)) return new Set();
    const set = new Set();
    for (const f of fs.readdirSync(API_DIR)) {
        if (f.endsWith('.ts')) {
            // /api/user-bundle.ts -> /api/user-bundle
            set.add('/api/' + f.replace(/\.ts$/, ''));
        }
    }
    return set;
}

function rewriteToRegex(source) {
    // /api/user/:action -> ^/api/user/[^/]+$
    // /api/((?!api/).*) -> raw regex (already valid)
    if (source.includes('(') || source.includes('[')) {
        // Already a regex pattern in vercel-flavored form — strip the leading ^ and trailing $ if absent
        try {
            return new RegExp('^' + source + '$');
        } catch {
            return null;
        }
    }
    const escaped = source
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/:[a-zA-Z_]+/g, '[^/]+');
    return new RegExp('^' + escaped + '$');
}

function matchesRewrite(apiPath, rewrites) {
    for (const r of rewrites) {
        const re = rewriteToRegex(r.source);
        if (!re) continue;
        if (re.test(apiPath)) return r;
    }
    return null;
}

function main() {
    console.log('🔍 Scanning frontend for /api/* string literals…');
    const files = walk(SRC_DIR);
    const found = new Map(); // apiPath -> [files]

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const p of extractApiPaths(content)) {
            if (!found.has(p)) found.set(p, []);
            found.get(p).push(path.relative(ROOT, file));
        }
    }

    const rewrites = loadVercelRewrites();
    const apiFiles = listApiFiles();

    console.log(`📂 Direct API files: ${apiFiles.size}`);
    console.log(`🔁 Rewrite rules:    ${rewrites.length}`);
    console.log(`🔗 Unique frontend routes: ${found.size}`);
    console.log('');

    const broken = [];
    const ok = [];
    for (const [apiPath, sources] of [...found.entries()].sort()) {
        if (apiFiles.has(apiPath)) {
            ok.push({ apiPath, resolution: 'direct file', sources });
            continue;
        }
        const rewrite = matchesRewrite(apiPath, rewrites);
        if (rewrite) {
            ok.push({ apiPath, resolution: `rewrite -> ${rewrite.destination}`, sources });
            continue;
        }
        broken.push({ apiPath, sources });
    }

    if (ok.length > 0) {
        console.log(`✅ ${ok.length} route(s) resolved`);
    }

    if (broken.length === 0) {
        console.log('\n🎉 All frontend /api/* routes are valid.');
        process.exit(0);
    }

    console.error(`\n❌ ${broken.length} route(s) do not match any API file or rewrite:`);
    for (const b of broken) {
        console.error(`\n  ${b.apiPath}`);
        for (const src of b.sources.slice(0, 5)) {
            console.error(`    used in ${src}`);
        }
        if (b.sources.length > 5) console.error(`    … +${b.sources.length - 5} more`);
    }
    process.exit(1);
}

main();
