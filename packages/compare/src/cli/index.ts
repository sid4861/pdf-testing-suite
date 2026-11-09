/**
 * `@pdfsuite/compare/cli` — the `compare` command, as a module the host loads.
 *
 * SR-NPM-PACKAGES decision 3: `@pdfsuite/cli` owns the `pdfsuite` binary and
 * does not depend on this package. It asks for this module **by name at run
 * time**, and when it is not installed it says so and exits 2. So installing
 * `@pdfsuite/compare` is what makes `pdfsuite compare` exist — which is what
 * Arpit asked for: installing compare must make everything available through
 * the CLI, and not installing it must not leave a command that half works.
 *
 * The module registers its own command, because the host does not know what
 * arguments `compare` takes and should not have to learn them in order to
 * pass them on.
 *
 * Note what is imported here. Everything from `@pdfsuite/cli` is a **type**,
 * erased at build time; the runtime pieces come from `@pdfsuite/core/node`,
 * which this package depends on anyway, or are handed over in `HostApi`.
 * This file is bundled separately from the host, so a runtime import of the
 * host would be a second copy of it — see the note in `host.ts`.
 */

import { ToolError } from '@pdfsuite/core/node';

import type { CommandModule, CommanderProgram, HostApi } from '@pdfsuite/cli';

import { runComparePair } from './pair';
import { runCompareEach } from './each';

/** Must match the host's, or the host refuses to load this module. */
const VERSION = '2.0.0';

export const command: CommandModule = {
  name: 'compare',
  version: VERSION,
  register(program: CommanderProgram, host: HostApi) {
    const c = host.colour;
    program
      .command('compare')
      .description('Compare one PDF against its golden, or every pair in two folders, and write the three files')
      .argument('[golden]', 'the golden PDF — or, with --each, the folder of them')
      .argument('[candidate]', 'the PDF to check — or, with --each, the folder of them')
      .option('-o, --out <dir>', 'directory to write result.json, report.html and manifest.json into')
      .option('--pages <map>', 'golden page : candidate page, e.g. "1:1,2:-,3:2"; "-" means no partner')
      .option('--each', 'compare every pair in two folders, one sub-folder of three files per pair', false)
      .option('--pixel-threshold <n>', 'pixelmatch sensitivity 0–1 [config: compare.pixelThreshold]', parseFloat, 0.1)
      .option('--include-aa', 'count anti-aliased pixels as differences [config: compare.includeAA]', false)
      .addHelpText(
        'after',
        `
${c.b('Examples')}
  pdfsuite compare ./golden/invoice.pdf ./candidate/invoice.pdf --out ./reports/invoice

  ${c.dim('# the pages do not line up: golden 2 was dropped, candidate 4 is new')}
  pdfsuite compare ./golden/report.pdf ./new/report.pdf --out ./out --pages "1:1,2:-,3:2,-:4"

  ${c.dim('# every pair in two folders, in one process')}
  pdfsuite compare --each ./golden ./candidate --out ./reports

${c.b('What it writes')}
  ${c.teal('result.json')}    the answer — every page with its verdict, why, metrics and changes,
                 the knobs that moved the verdict, and both files with their hashes
  ${c.teal('report.html')}    the same thing to read: self-contained, no script, changed pages imaged
  ${c.teal('manifest.json')}  every input and output with its size and SHA-256

${c.b('Exit codes')}
  ${c.green('0')}  nothing changed. With --each: no pair changed, and no file is missing or new.
  ${c.red('1')}  a page changed — or, with --each, a pair changed or a file appeared or vanished.
  ${c.yellow('2')}  bad arguments, or a PDF that cannot be read.

${c.b('A page changes if it differs at all')}
  ${c.dim('There are no tolerances. A knob that lets a real change be called')}
  ${c.dim('acceptable only hides it. The pixel and anti-aliasing settings move the')}
  ${c.dim('verdict, so both are recorded in result.json.')}

${c.b('Moved from 1.x')}
  ${c.dim('pairs.json, the folder-pair arguments and the `pairs` command are gone, and')}
  ${c.dim('so are the JUnit, CSV and Markdown writers. Two folders become --each; a')}
  ${c.dim('pipeline that read JUnit reads result.json, which says more and is versioned.')}
`,
      )
      .action(((golden: string | undefined, candidate: string | undefined, opts: {
        out?: string; pages?: string; each: boolean;
        pixelThreshold: number; includeAa: boolean;
      }) => host.run(() => {
        // The host owns --config; this only reads the section it was handed.
        const { values, source } = host.config('compare');
        if (source) console.log(`config: ${source}`);

        if (!golden || !candidate) {
          throw new ToolError(
            'Give two PDFs to compare.',
            'pdfsuite compare <golden.pdf> <candidate.pdf> --out <dir>, '
              + 'or --each <golden-dir> <candidate-dir> --out <dir>.',
          );
        }

        // A flag beats the config file; the flag defaults above are the floor.
        const pixelThreshold = Number.isFinite(opts.pixelThreshold)
          ? opts.pixelThreshold
          : (values.pixelThreshold as number | undefined) ?? 0.1;
        const includeAA = opts.includeAa === true
          || (opts.includeAa === undefined && values.includeAA === true);

        if (opts.each) {
          if (opts.pages) {
            throw new ToolError(
              '--pages is for one pair, and --each runs many.',
              'Compare that pair on its own to give it a pairing.',
            );
          }
          return runCompareEach({
            goldenDir: golden, candidateDir: candidate, out: opts.out,
            pixelThreshold, includeAA,
          });
        }

        return runComparePair({
          golden, candidate, out: opts.out, pages: opts.pages,
          pixelThreshold, includeAA,
        });
      })) as never);
  },
};

export default command;
