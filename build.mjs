import { build } from 'esbuild';
await build({
  entryPoints: ['src/player.js'], outfile: 'assets/assembly.js', bundle: true,
  format: 'iife', target: ['es2022'], minify: true, legalComments: 'eof', loader:{'.hdr':'binary'},
});
