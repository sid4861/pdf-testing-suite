#!/usr/bin/env node
// `pdfsuite-compare` — the same command, reachable from a global install.
//
// Measured for W-30: a **local** install links a dependency's bin into
// `node_modules/.bin`, so `npm i @pdfsuite/compare` already gives you
// `npx pdfsuite`. A **global** install links only the top package's own bin,
// so `npm i -g @pdfsuite/compare` would put `pdfsuite` nowhere. Hence this
// file, and SR-NPM-PACKAGES decision 4.
//
// It is a forwarder, not a second entry point: it inserts the sub-command and
// hands over to the host, so there is exactly one place that parses
// arguments, reads the config file and decides exit codes (L3).

process.argv.splice(2, 0, 'compare');

await import('@pdfsuite/cli/bin');
