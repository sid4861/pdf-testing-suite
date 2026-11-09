#!/usr/bin/env node
// `pdfsuite-spec` — the same command, reachable from a global install.
//
// A global install links only the top package's own bin, not its
// dependencies', so `npm i -g @pdfsuite/spec` would otherwise put nothing on
// the PATH (SR-NPM-PACKAGES decision 4). This forwards: it inserts the
// sub-command and hands over to the host, so one place still parses
// arguments, reads the config file and decides exit codes (L3).

process.argv.splice(2, 0, 'spec');

await import('@pdfsuite/cli/bin');
