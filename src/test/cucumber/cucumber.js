module.exports = {
  default: {
    require: [
      'step_definitions/**/*.js',
      'support/**/*.js'
    ],

    format: ['progress'],
    paths: ['features/'],
    parallel: 1,
    timeout: 60000
  }
};
