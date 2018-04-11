module.exports = {
  root: true,
  extends: "standard",
  env: {
    jest: true,
    node: true,
    es6: true,
  },
  rules: {
    // Custom overrides
    'space-before-function-paren': 0
  }
};