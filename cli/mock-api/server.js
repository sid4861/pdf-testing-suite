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

app.get('/health', (_req, res) => {
  const missing = Object.values(TEMPLATES).filter((f) => !fs.existsSync(path.join(SAMPLES, f)));
  res.status(missing.length ? 503 : 200).json({
    status: missing.length ? 'degraded' : 'ok',
    samplesDir: SAMPLES,
    templates: Object.keys(TEMPLATES),
    missing,
  });
});

app.post('/render', async (req, res) => {
  const { fail, latency } = req.query;

  if (latency) await new Promise((r) => setTimeout(r, Number(latency)));
  if (fail === '1') {
    return res.status(500).json({ error: 'Simulated render failure (?fail=1)' });
  }

  const payload = req.body ?? {};
  const template = payload.template;

  if (!template) {
    return res.status(400).json({
      error: 'Payload must include a "template" field.',
      available: Object.keys(TEMPLATES),
    });
  }
  if (!TEMPLATES[template]) {
    return res.status(404).json({
      error: `Unknown template "${template}".`,
      available: Object.keys(TEMPLATES),
    });
  }

  const file = path.join(SAMPLES, TEMPLATES[template]);
  if (!fs.existsSync(file)) {
    return res.status(503).json({ error: `Sample file missing on disk: ${file}` });
  }

  const pdfBase64 = fs.readFileSync(file).toString('base64');
  console.log(
    `[render] ${payload.documentId ?? '(no id)'} · template=${template} · ${(pdfBase64.length / 1024).toFixed(0)}KB base64`,
  );

  res.json({
    documentId: payload.documentId ?? null,
    template,
    generatedAt: new Date().toISOString(),
    pdfBase64,
  });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Mock render API listening on http://localhost:${port}`);
  console.log(`  POST /render   serving samples from ${SAMPLES}`);
  console.log(`  GET  /health`);
});
