/**
 * `@pdfsuite/spec/cli` — the `spec` command, as a module the host loads.
 *
 * W-30 built the host and left this command compiled into it, because
 * `@pdfsuite/spec` did not exist yet and reporting a working command as "not
 * installed" would have been a regression. **W-32** makes the package, so the
 * command moves where it belongs: installing `@pdfsuite/spec` is now what
 * makes `pdfsuite spec` exist (SR-NPM-PACKAGES decision 3).
 *
 * Everything from `@pdfsuite/cli` here is a **type**, erased at build time —
 * this module is bundled separately from the host, so a runtime import of it
 * would be a second copy. See the note at the top of the host's `host.ts`.
 */

import { ToolError } from '@pdfsuite/core/node';

import type { CommandModule, CommanderProgram, HostApi } from '@pdfsuite/cli';

import { runSpecCommand } from './run';

/** Must match the host's, or the host refuses to load this module. */
const VERSION = '2.0.0';

export const command: CommandModule = {
  name: 'spec',
  version: VERSION,
  register(program: CommanderProgram, host: HostApi) {
    const c = host.colour;
    program
      .command('spec')
      .description('Check one PDF against a spec workbook or spec JSON, and write the three files')
      .argument('[spec]', 'Template v2 workbook (.xlsx) or spec JSON')
      .argument('[pdf]', 'the PDF to check (omit with --validate-only)')
      .option('-o, --out <dir>', 'directory to write result.json, report.html and manifest.json into')
      .option('--pages <map>', 'spec page : PDF page, e.g. "1:2,2:3" — overrides the Pages List binding')
      .option('--validate-only', 'read the spec and report on it; open no PDF', false)
      .option('--template <file>', 'write a blank Template v2 workbook to start from, and stop')
      .addHelpText(
        'after',
        `
${c.b('Examples')}
  pdfsuite spec ./report-spec.xlsx ./report.pdf --out ./reports/report

  ${c.dim('# start a spec: a blank Template v2 workbook to fill in')}
  pdfsuite spec --template ./report-spec.xlsx

  ${c.dim('# check the spec alone, before anyone has a PDF to test')}
  pdfsuite spec ./report-spec.xlsx --validate-only

  ${c.dim('# the document is right but its identifying text was edited')}
  pdfsuite spec ./spec.json ./report.pdf --out ./out --pages "2:3"

${c.b('What it writes')}
  ${c.teal('result.json')}    the answer — every element with its expected, actual, delta and
                 the workbook cell it came from, plus coverage and the pair tested
  ${c.teal('report.html')}    the same thing to read: self-contained, no script, failing pages imaged
  ${c.teal('manifest.json')}  every input and output with its size and SHA-256

${c.b('Exit codes')}
  ${c.green('0')}  no failed assertion. Warnings, notes and unverifiable elements are listed and allowed.
  ${c.red('1')}  a failed assertion, or an error finding such as a Required page missing.
  ${c.yellow('2')}  bad arguments, or the spec itself does not read.

${c.b('The spec is validated first')}
  ${c.dim('Nothing is checked against a PDF until the workbook reads. A refused row')}
  ${c.dim('names its own cell, so the fix is made in Excel and not guessed at.')}
  ${c.dim('A legacy workbook is refused here: convert it in the app, which hands back')}
  ${c.dim('a draft Template v2 workbook to confirm.')}
`,
      )
      .action(((spec: string | undefined, pdf: string | undefined, opts: {
        out?: string; pages?: string; validateOnly: boolean; template?: string;
      }) => host.run(() => {
        if (!opts.template && !spec) {
          throw new ToolError(
            'No spec given.',
            'pdfsuite spec <spec> <file.pdf> --out <dir>, or --template <file> to start one.',
          );
        }
        return runSpecCommand({
          spec: spec ?? '',
          pdf,
          out: opts.out,
          pages: opts.pages,
          validateOnly: opts.validateOnly === true,
          template: opts.template,
        });
      })) as never);
  },
};

export default command;
