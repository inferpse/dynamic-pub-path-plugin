class DynamicPubPathPlugin {
  constructor(options) {
    this.options = Object.assign({
      expression: null
    }, options);
  }
  apply(compiler) {
    const { expression } = this.options;
    compiler.hooks.compilation.tap('DynamicPubPathPlugin', compilation => {
      compilation.mainTemplate.hooks.requireExtensions.tap('DynamicPubPathPlugin', source => {
        return source.replace(/(__webpack_require__\.p) = (.*);/, `$1 = (function(o){ o.toString = function() { return ${expression} }; return o; }({}))`)
      });
    });
  }
}

module.exports = DynamicPubPathPlugin;
