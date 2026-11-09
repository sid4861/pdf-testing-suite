// Dummy render API — a stand-in for the real PDF generation service.
//
// Contract (this is what the real API must match, or be adapted to with
// `generate --response-path`):
//
//   POST /render
//   body: any JSON. A `template` field selects which sample PDF comes back.
//   200 : { "documentId": "...", "template": "...", "pdfBase64": "<base64>" }
//   4xx : { "error": "..." }
//
// It serves the PDFs already bundled with the React app (../../public/samples) rather than
// generating anything, so the CLI can be exercised end to end without a PDF generator.
//
// Test affordances — these exist so the pipeline can be proven to actually catch a
// regression, rather than passing because nothing is ever different:
//
//   template: "invoice-recreated"  → differs from the invoice-original golden  (FAIL)
//   template: "invoice-original"   → byte-identical to the golden              (PASS)
//   ?fail=1                        → 500, to exercise --retries
//   ?latency=2000                  → delay in ms, to exercise --timeout

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.resolve(here, '../../public/samples');

// Logical template name → file in the app's sample set.
const TEMPLATES = {
  'invoice-original': 'invoice-original.pdf',
  'invoice-recreated': 'invoice-recreated.pdf',
  'statement-original': 'spec-sample.pdf',
  'statement-recreated': 'spec-sample.pdf',
};

const app = express();
app.use(express.json({ limit: '5mb' }));

// ── auth ──────────────────────────────────────────────────────────────
// Optional, so the default quick-start needs no credentials. Set any of these env vars
// and the matching scheme is enforced, which is how the CLI's auth config gets exercised
// against something that actually rejects bad credentials.
//
//   MOCK_BEARER_TOKEN=...   Authorization: Bearer <token>
//   MOCK_BASIC_USER/PASS    Authorization: Basic base64(user:pass)
//   MOCK_API_KEY=...        X-API-Key: <key>   or   ?api_key=<key>
const AUTH = {
  bearer: process.env.MOCK_BEARER_TOKEN,
  basicUser: process.env.MOCK_BASIC_USER,
  basicPass: process.env.MOCK_BASIC_PASS,
  apiKey: process.env.MOCK_API_KEY,
};

function checkAuth(req) {
  const header = req.headers.authorization ?? '';

  if (AUTH.bearer) {
    if (header !== `Bearer ${AUTH.bearer}`) return 'Bad or missing Bearer token';
    return null;
  }
  if (AUTH.basicUser) {
    const expected =
      'Basic ' + Buffer.from(`${AUTH.basicUser}:${AUTH.basicPass ?? ''}`, 'utf8').toString('base64');
    if (header !== expected) return 'Bad or missing Basic credentials';
    return null;
  }
  if (AUTH.apiKey) {
    const supplied = req.headers['x-api-key'] ?? req.query.api_key;
    if (supplied !== AUTH.apiKey) return 'Bad or missing API key (X-API-Key header or ?api_key=)';
    return null;
  }
  return null; // no scheme configured — open
}

/** Resolve the requested template to a file, or an { error } describing why not. */
function resolveTemplate(payload) {
  const template = payload?.template;
  if (!template) {
    return { error: 'Payload must include a "template" field.', status: 400 };
  }
  if (!TEMPLATES[template]) {
    return { error: `Unknown template "${template}".`, status: 404 };
  }
  const file = path.join(SAMPLES, TEMPLATES[template]);
  if (!fs.existsSync(file)) {
    return { error: `Sample file missing on disk: ${file}`, status: 503 };
  }
  return { file, template };
}

app.get('/health', (_req, res) => {
  const missing = Object.values(TEMPLATES).filter((f) => !fs.existsSync(path.join(SAMPLES, f)));
  res.status(missing.length ? 503 : 200).json({
    status: missing.length ? 'degraded' : 'ok',
    samplesDir: SAMPLES,
    templates: Object.keys(TEMPLATES),
    missing,
  });
});

/** Shared preamble: auth, simulated latency/failure, template resolution. */
async function prepare(req, res) {
  const { fail, latency } = req.query;

  const authError = checkAuth(req);
  if (authError) {
    res.status(401).json({ error: authError });
    return null;
  }

  if (latency) await new Promise((r) => setTimeout(r, Number(latency)));
  if (fail === '1') {
    res.status(500).json({ error: 'Simulated render failure (?fail=1)' });
    return null;
  }

  const resolved = resolveTemplate(req.body ?? {});
  if (resolved.error) {
    res.status(resolved.status).json({ error: resolved.error, available: Object.keys(TEMPLATES) });
    return null;
  }
  return resolved;
}

// ── JSON + base64 (the default shape) ─────────────────────────────────
app.post('/render', async (req, res) => {
  const resolved = await prepare(req, res);
  if (!resolved) return;

  const pdfBase64 = fs.readFileSync(resolved.file).toString('base64');
  console.log(
    `[render:json] ${req.body?.documentId ?? '(no id)'} · template=${resolved.template} · ${(pdfBase64.length / 1024).toFixed(0)}KB base64`,
  );

  res.json({
    documentId: req.body?.documentId ?? null,
    template: resolved.template,
    generatedAt: new Date().toISOString(),
    pdfBase64,
  });
});

// ── nested JSON, for exercising --response-path ───────────────────────
app.post('/render-nested', async (req, res) => {
  const resolved = await prepare(req, res);
  if (!resolved) return;

  const content = fs.readFileSync(resolved.file).toString('base64');
  console.log(`[render:nested] template=${resolved.template}`);
  res.json({ data: { document: { content, mimeType: 'application/pdf' } } });
});

// ── raw binary: the body IS the PDF ───────────────────────────────────
app.post('/render-binary', async (req, res) => {
  const resolved = await prepare(req, res);
  if (!resolved) return;

  const pdf = fs.readFileSync(resolved.file);
  console.log(`[render:binary] template=${resolved.template} · ${(pdf.length / 1024).toFixed(1)}KB`);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
});

// ── bare base64 text, no JSON wrapper ─────────────────────────────────
app.post('/render-base64', async (req, res) => {
  const resolved = await prepare(req, res);
  if (!resolved) return;

  console.log(`[render:base64] template=${resolved.template}`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(fs.readFileSync(resolved.file).toString('base64'));
});

// ── GET variant: template comes from the query string, no body ────────
app.get('/render', async (req, res) => {
  const authError = checkAuth(req);
  if (authError) return res.status(401).json({ error: authError });

  const resolved = resolveTemplate({ template: req.query.template });
  if (resolved.error) {
    return res.status(resolved.status).json({ error: resolved.error, available: Object.keys(TEMPLATES) });
  }
  console.log(`[render:get] template=${resolved.template}`);
  res.json({ pdfBase64: fs.readFileSync(resolved.file).toString('base64') });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Mock render API listening on http://localhost:${port}`);
  console.log(`  serving samples from ${SAMPLES}`);
  console.log('');
  console.log('  POST /render          { pdfBase64 }        default JSON shape');
  console.log('  POST /render-nested   { data.document.content }  for --response-path');
  console.log('  POST /render-binary   application/pdf      for responseMode "binary"');
  console.log('  POST /render-base64   bare base64 text     for responseMode "base64"');
  console.log('  GET  /render?template=…                    for --method GET');
  console.log('  GET  /health');
  const scheme = AUTH.bearer ? 'Bearer' : AUTH.basicUser ? 'Basic' : AUTH.apiKey ? 'API key' : 'none';
  console.log(`  auth: ${scheme}`);
});
