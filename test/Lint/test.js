var lint = require('mocha-eslint');

var paths = [
    'index.js',
    'ports/**/*.js',
    'servers/**/*.js',
    'apis/**/*.js',
    'utils/**/*.js',
    'examples/**/*.js'
];

var options = {
  // Specify style of output
    formatter: 'compact'  // Defaults to `stylish`
};

// Run the tests
lint(paths, options);
