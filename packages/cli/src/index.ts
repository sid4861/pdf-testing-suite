#!/usr/bin/env node
// pdfsuite — headless PDF comparison for CI.
//
// The DOM shim must be installed before anything pulls in the app's services, so
// platform/engine.js is imported (transitively) only from the command modules below,
// which are themselves loaded after this import.

import '../src/platform/dom-shim.js';

import { Command } from 'commander';

import { EXIT, ToolError, isToolError } from './core/exit.js';
import {
  loadConfig,
  mergeHeaders,
  pick,
  buildUrl,
  normalizeMethod,
  normalizeResponseMode,
  CONFIG_FILENAME,
} from './core/config.js';
import { installPdfLogFilter } from './platform/pdf-log.js';
import { DISCOVERABLE, loadCommand, notInstalled } from './core/discover.js';
import { runGenerate } from './commands/generate.js';
import { runInspect } from './commands/inspect.js';
import type { CommanderProgram, HostApi } from './host.js';

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

/** Mirrors `commands/inspect.ts`, which owns the rule; named here for the help text. */
const IMAGE_PAGE_CAP = 20;

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

  ${c.dim('# 2.')} check one against its golden, or every pair in two folders
  ${c.teal('pdfsuite compare')} ./golden/invoice.pdf ./candidates/invoice.pdf --out ./reports/invoice
  ${c.teal('pdfsuite compare')} --each ./golden ./candidates --out ./reports

${c.b('No golden PDF?')}
  ${c.dim('# check a PDF against the spec workbook that describes it')}
  ${c.teal('pdfsuite spec')} ./report-spec.xlsx ./report.pdf --out ./reports/report

${c.b('Just tell me what is on the page')}
  ${c.dim('# every element with its position, font and line height')}
  ${c.teal('pdfsuite inspect')} ./report.pdf --page 3 --out ./reports/page3

${c.b('Exit codes')}
  ${c.green('0')}  every pair passed
  ${c.red('1')}  a pair differs ${c.dim('— the PDFs are not the same')}
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

/**
 * What a loaded command module is handed (SR-NPM-PACKAGES decision 3).
 *
 * Deliberately small, and deliberately the *only* runtime channel: the module
 * is a separate bundle, so anything it imported from the host instead would
 * be a second copy. Exit codes, the error type and `fileFromPath` come from
 * `@pdfsuite/core/node`, which both bundles share.
 */
const host: HostApi = {
  run,
  colour: c,
  config: (section: string) => {
    const { config, source } = loadConfigFor();
    const values = (config as Record<string, unknown>)[section];
    return {
      values: (values ?? {}) as Record<string, unknown>,
      ...(source ? { source } : {}),
    };
  },
};

// ── inspect ── built in, because it needs only core (W-28) ───────
program
  .command('inspect')
  .description('Read one PDF and report every element with its position, font and line height')
  .argument('[file]', 'the PDF to inspect')
  .option('-o, --out <dir>', 'directory to write result.json, report.html and manifest.json into')
  .option('-p, --page <n>', 'inspect one page only, counting from 1', toInt)
  .option('--images', `embed page images in the report even past ${IMAGE_PAGE_CAP} pages`)
  .option('--no-images', 'leave page images out of the report')
  .addHelpText(
    'after',
    `
${c.b('Examples')}
  pdfsuite inspect ./report.pdf --out ./reports/report

  ${c.dim('# one page, which is what you want when you know where to look')}
  pdfsuite inspect ./report.pdf --page 3 --out ./out

  ${c.dim('# the numbers only — no page images in the report')}
  pdfsuite inspect ./report.pdf --out ./out --no-images

${c.b('What it writes')}
  ${c.teal('result.json')}    every element: kind, text, font, size, weight, its box in inches
                 from all four page edges, and its line height and leading ratio
  ${c.teal('report.html')}    the same thing to read, page by page, self-contained, no script
  ${c.teal('manifest.json')}  every input and output with its size and SHA-256

${c.b('Exit codes')}
  ${c.green('0')}  the document was read. ${c.dim('An inspect has no verdict — it answers a question.')}
  ${c.yellow('2')}  bad arguments, or a PDF that cannot be read.

${c.b('Units, said once')}
  ${c.dim('Positions and distances in inches, font sizes in points, measured from')}
  ${c.dim('the page\'s top-left. The conversion happens in one place, in the core,')}
  ${c.dim('and result.json records which units it used.')}

${c.b('What is not stated is not guessed')}
  ${c.dim('A font with no resolvable name is reported as not stated, and so is the')}
  ${c.dim('weight that would have been read off it. A page with no text layer says')}
  ${c.dim('so rather than appearing empty.')}
`,
  )
  .action(async (file: string | undefined, opts: {
    out?: string; page?: number; images: boolean;
  }, cmd) => {
    await run(() => {
      if (!file) {
        throw new ToolError(
          'Give a PDF to inspect.',
          'pdfsuite inspect <file.pdf> --out <dir>',
        );
      }
      return runInspect({
        file,
        page: opts.page,
        out: opts.out,
        images: opts.images !== false,
        // Commander folds --images and --no-images onto one property, so the
        // only way to tell "left at the default" from "asked for" is to ask
        // where the value came from.
        imagesStated: cmd.getOptionValueSource('images') === 'cli',
      });
    });
  });

// ── compare and spec ── loaded from their own packages ──────────
//
// Neither is built in. Each package exports a command module and the host
// loads it at run time, so installing compare or spec is what makes
// `pdfsuite compare` or `pdfsuite spec` exist (SR-NPM-PACKAGES decision 3).
// A command whose package is missing is still *listed*, with the install line
// as its description — "unknown command" would be a lie, because the command
// is known.
//
// `spec` joined with **W-32**, which made `@pdfsuite/spec` a package. The
// host now knows both commands by name and neither by code — `generate` is
// the only thing it still runs itself.
{
  const wanted = process.argv[2];
  const askingWhatExists =
    process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h');

  for (const [name, entry] of Object.entries(DISCOVERABLE)) {
    // Only load what this invocation needs: the module carries a PDF engine,
    // and `pdfsuite generate` has no business paying for it.
    if (wanted !== name && !askingWhatExists) continue;

    let command = null;
    try {
      command = await loadCommand(name);
    } catch (err) {
      reportToolError(err);
      process.exit(EXIT.TOOL_ERROR);
    }

    if (command) {
      // The narrow interface in host.ts is what the module may rely on; this
      // is the real commander `Command` it is a subset of.
      command.register(program as unknown as CommanderProgram, host);
      continue;
    }
    if (wanted === name) {
      reportToolError(notInstalled(name));
      process.exit(EXIT.TOOL_ERROR);
    }
    // Listed, so `--help` tells the truth about what this install can do.
    program
      .command(name)
      .description(`${entry.what} — needs ${entry.pkg} (npm i ${entry.pkg})`)
      .allowUnknownOption(true)
      .action(() => {
        reportToolError(notInstalled(name));
        process.exit(EXIT.TOOL_ERROR);
      });
  }
}

/** A tool error, printed the way the top level prints one. */
function reportToolError(err: unknown): void {
  if (isToolError(err)) {
    console.error(`\nError: ${err.message}`);
    if (err.hint) console.error(`  ${err.hint}`);
  } else {
    console.error('\nUnexpected error:', err);
  }
}

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
