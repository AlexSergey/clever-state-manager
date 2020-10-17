const { libraryCompiler } = require('@rockpack/compiler');

libraryCompiler({
  name: 'StateManager',
  cjs: {
    src: './src',
    dist: './lib/cjs'
  },
  esm: {
    src: './src',
    dist: './lib/esm'
  }
});
