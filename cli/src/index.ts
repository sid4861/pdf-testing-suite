#!/usr/bin/env node
// pdfsuite — headless PDF comparison for CI.
//
// The DOM shim must be installed before anything pulls in the app's services, so
// platform/engine.js is imported (transitively) only from the command modules below,
// which are themselves loaded after this import.

import '../src/platform/dom-shim.js';

import { Command } from 'commander';

import { EXIT, ToolError } from './core/exit.js';
import { loadConfig, mergeHeaders, pick, CONFIG_FILENAME } from './core/config.js';
import { installPdfLogFilter } from './platform/pdf-log.js';
import { runGenerate } from './commands/generate.js';
import { runCompare, runPairs } from './commands/compare.js';

// Subtle colour, but only when a human is watching. Piped output and CI logs stay clean,
// and NO_COLOR is honoured.
const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;
const c = {
  b: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  teal: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
};

const program = new Command();

program
  .name('pdfsuite')
  .description('Generate PDFs from JSON payloads and check them against golden references.')
  .version('1.0.0', '-V, --version', 'show the version')
  .option('-v, --verbose', 'show pdf.js font/rendering warnings', false)
  .option('--config <file>', `path to ${CONFIG_FILENAME} (default: discovered)`)
  .option('--no-config', 'ignore any config file and use flags/defaults only')
  .showHelpAfterError('(run `pdfsuite --help` to see all commands)')
  .addHelpText(
    'after',
    `
${c.b('Typical run')}
  ${c.dim('# 1.')} fill a directory with candidate PDFs
  ${c.teal('pdfsuite generate')} --payloads ./payloads --out ./candidates

  ${c.dim('# 2.')} check them against the goldens, write reports
  ${c.teal('pdfsuite compare')} --reference ./golden --candidate ./candidates --pairs ./pairs.json --report ./reports

  ${c.dim('# 3.')} preview the pairing without comparing anything
  ${c.teal('pdfsuite pairs')} --reference ./golden --candidate ./candidates --pairs ./pairs.json

${c.b('Exit codes')}
  ${c.green('0')}  every pair passed
  ${c.red('1')}  a pair breached its thresholds ${c.dim('— the PDFs changed')}
  ${c.yellow('2')}  tool error ${c.dim('— bad args, API unreachable, unmatched pair, nothing to compare')}

${c.b('Configuration')}
  The API url, headers and timeouts come from ${c.teal(CONFIG_FILENAME)}, found by walking up
  from the current directory. Only the paths to process are passed as flags.
  An explicit flag always overrides the config file.

${c.dim('Run `pdfsuite <command> --help` for the full flag list of any command.')}
`,
  );

// ── generate ──────────────────────────────────────────────────────────
program
  .command('generate')
  .description('POST each JSON payload to the render API and save the returned PDFs')
  .option('-p, --payloads <dir>', 'directory of .json payload files [config: paths.payloads]')
  .option('-o, --out <dir>', 'directory to write PDFs into [config: paths.out]')
  // Every option below falls back to the config file when not passed explicitly.
  .option('-a, --api <url>', 'render endpoint [config: api.url]')
  .option('-X, --method <verb>', 'HTTP method [config: api.method]', 'POST')
  .option(
    '--response-mode <mode>',
    'json | binary | base64 — how the PDF arrives [config: api.responseMode]',
    'json',
  )
  .option('-c, --concurrency <n>', 'requests in flight [config: api.concurrency]', toInt, 4)
  // Defaults assume a SLOW render API (20–40s/doc). The timeout must sit well clear of
  // the worst response time: firing on a healthy-but-slow response is worse than waiting.
  .option('-t, --timeout <ms>', 'per-request timeout [config: api.timeout]', toInt, 120000)
  .option('-r, --retries <n>', 'retries on 5xx/network error [config: api.retries]', toInt, 2)
  .option(
    '--retry-on-timeout',
    'also retry timeouts (off by default — against a slow API the retry usually times out too, tripling wall time) [config: api.retryOnTimeout]',
    false,
  )
  .option('--retry-backoff <ms>', 'base backoff, doubled per attempt [config: api.retryBackoff]', toInt, 2000)
  .option(
    '--heartbeat <ms>',
    'progress line interval while requests are in flight; 0 disables [config: api.heartbeat]',
    toInt,
    15000,
  )
  .option('--response-path <path>', 'dot-path to the base64 PDF in the response [config: api.responsePath]', 'pdfBase64')
  .option('-H, --header <header...>', 'extra request header ("Name: value"), merged over config', [])
  .option('--skip-existing', 'reuse PDFs already on disk (resume a partial run)', false)
  .option('--fail-fast', 'stop at the first failure', false)
  .addHelpText(
    'after',
    `
${c.b('Examples')}
  ${c.dim('# url, headers and timeouts come from')} ${CONFIG_FILENAME}
  pdfsuite generate --payloads ./payloads --out ./candidates

  ${c.dim('# point at a different backend for one run')}
  pdfsuite generate --payloads ./payloads --out ./candidates --api https://staging.example.com/render

  ${c.dim('# resume after a partial failure — only re-fetches what is missing')}
  pdfsuite generate --payloads ./payloads --out ./candidates --skip-existing

${c.b('Notes')}
  Each ${c.teal('<name>.json')} in --payloads becomes ${c.teal('<name>.pdf')} in --out. That name is what
  pairs.json refers to, so keep it stable.
  Discovery is not recursive — only files directly inside --payloads are read.
  The payload body is sent verbatim; the CLI never requires any particular field.
`,
  )
  .action(async (opts, cmd) => {
    await run(() => {
      const { config, source } = loadConfigFor();
      const api = config.api ?? {};
      const paths = config.paths ?? {};
      const src = (flag: string) => cmd.getOptionValueSource(flag);

      const baseUrl = pick(src('api'), opts.api, api.url);
      if (!baseUrl) {
        throw new ToolError(
          'No render API URL.',
          `Set "api": { "url": "…" } in ${CONFIG_FILENAME}, or pass --api <url>.`,
        );
      }

      const payloads = pick(src('payloads'), opts.payloads, paths.payloads);
      const out = pick(src('out'), opts.out, paths.out);
      if (!payloads) {
        throw new ToolError('No payload directory.', 'Pass --payloads <dir>, or set "paths": { "payloads": "…" }.');
      }
      if (!out) {
        throw new ToolError('No output directory.', 'Pass --out <dir>, or set "paths": { "out": "…" }.');
      }

      if (source) console.log(`config: ${source}`);

      return runGenerate({
        payloads,
        out,
        api: buildUrl(baseUrl, api.query, api.auth),
        method: normalizeMethod(pick(src('method'), opts.method, api.method)),
        responseMode: normalizeResponseMode(
          pick(src('responseMode'), opts.responseMode, api.responseMode),
        ),
        concurrency: pick(src('concurrency'), opts.concurrency, api.concurrency),
        timeout: pick(src('timeout'), opts.timeout, api.timeout),
        retries: pick(src('retries'), opts.retries, api.retries),
        retryOnTimeout: pick(src('retryOnTimeout'), opts.retryOnTimeout, api.retryOnTimeout),
        retryBackoff: pick(src('retryBackoff'), opts.retryBackoff, api.retryBackoff),
        heartbeat: pick(src('heartbeat'), opts.heartbeat, api.heartbeat),
        responsePath: pick(src('responsePath'), opts.responsePath, api.responsePath),
        header: mergeHeaders(api.headers, opts.header ?? [], api.auth),
        skipExisting: opts.skipExisting,
        failFast: opts.failFast,
      });
    });
  });

// ── compare ───────────────────────────────────────────────────────────
program
  .command('compare')
  .description('Compare candidate PDFs against golden references and write reports')
  .requiredOption('-r, --reference <dir>', 'directory of golden/reference PDFs')
  .requiredOption('-c, --candidate <dir>', 'directory of PDFs to check')
  .requiredOption('-P, --pairs <file>', 'pairs.json describing which file maps to which')
  .requiredOption('-o, --report <dir>', 'directory to write reports into')
  .option('-f, --format <list>', 'html,json,csv,junit [config: compare.format]', 'html,json,csv,junit')
  .option('--pixel-threshold <n>', 'pixelmatch sensitivity 0–1 [config: compare.pixelThreshold]', parseFloat, 0.1)
  .option('--include-aa', 'count anti-aliased pixels as differences [config: compare.includeAA]', false)
  .option('--fail-on <mode>', 'any | none (none = report only, always exit 0) [config: compare.failOn]', 'any')
  .addHelpText(
    'after',
    `
${c.b('Examples')}
  pdfsuite compare --reference ./golden --candidate ./candidates --pairs ./pairs.json --report ./reports

  ${c.dim('# just the CI-facing outputs, skip the heavy visual report')}
  pdfsuite compare -r ./golden -c ./candidates -P ./pairs.json -o ./reports --format junit,json

  ${c.dim('# produce reports but never fail the build')}
  pdfsuite compare -r ./golden -c ./candidates -P ./pairs.json -o ./reports --fail-on none

${c.b('A page fails if any threshold is breached')}
  content match   must be ${c.teal('>=')} contentPct   ${c.dim('wording changed')}
  pixels differ   must be ${c.teal('<=')} pixelPct     ${c.dim('colour / spacing / graphics changed')}
  max offset      must be ${c.teal('<=')} offsetIn     ${c.dim('layout drifted')}
  ${c.dim('A page present on only one side always fails.')}

${c.dim('Thresholds live in pairs.json — globally under "defaults", per pair under "thresholds".')}
`,
  )
  .action(async (opts, cmd) => {
    await run(() => {
      const { config, source } = loadConfigFor();
      const cmp = config.compare ?? {};
      const src = (flag: string) => cmd.getOptionValueSource(flag);

      if (source) console.log(`config: ${source}`);

      const failOn = pick(src('failOn'), opts.failOn, cmp.failOn);
      return runCompare({
        reference: opts.reference,
        candidate: opts.candidate,
        pairs: opts.pairs,
        report: opts.report,
        format: pick(src('format'), opts.format, cmp.format),
        pixelThreshold: pick(src('pixelThreshold'), opts.pixelThreshold, cmp.pixelThreshold),
        includeAA: pick(src('includeAa'), opts.includeAa ?? false, cmp.includeAA),
        failOn: failOn === 'none' ? 'none' : 'any',
      });
    });
  });

// ── pairs ─────────────────────────────────────────────────────────────
program
  .command('pairs')
  .description('Resolve and print the pairing table without comparing anything')
  .requiredOption('-r, --reference <dir>', 'directory of golden/reference PDFs')
  .requiredOption('-c, --candidate <dir>', 'directory of PDFs to check')
  .requiredOption('-P, --pairs <file>', 'pairs.json')
  .action(async (opts) => {
    await run(() =>
      runPairs({ reference: opts.reference, candidate: opts.candidate, pairs: opts.pairs }),
    );
  });

function toInt(value: string): number {
  return parseInt(value, 10);
}

/**
 * Global --config / --no-config, resolved once per invocation.
 *
 * Commander folds both onto one property: `true` by default (discover), a string when
 * `--config <file>` is given, `false` when `--no-config` is passed.
 */
function loadConfigFor() {
  const raw = program.opts().config as string | boolean | undefined;
  const explicitPath = typeof raw === 'string' ? raw : undefined;
  const useConfig = raw !== false;
  return loadConfig(explicitPath, useConfig);
}

/** Single place where exit codes and error presentation are decided. */
async function run(fn: () => Promise<number> | number): Promise<never> {
  installPdfLogFilter(program.opts().verbose === true);
  try {
    process.exitCode = await fn();
  } catch (err) {
    if (err instanceof ToolError) {
      console.error(`\nError: ${err.message}`);
      if (err.hint) console.error(`  ${err.hint}`);
    } else {
      console.error('\nUnexpected error:', err);
    }
    process.exitCode = EXIT.TOOL_ERROR;
  }
  process.exit(process.exitCode);
}

// Running `pdfsuite` with no arguments is someone asking what this tool does — that is a
// successful outcome, not an error. Commander's default is to exit 1.
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(EXIT.OK);
}

program.parseAsync(process.argv);
