var RawSource = require('webpack-sources').RawSource;

function DynamicPubPathPlugin(options) {
  this.options = options || {};
}

DynamicPubPathPlugin.prototype.apply = function(compiler) {
  var options = this.options;
  var jsregex = options.test || /\.js($|\?)/i;

  compiler.plugin('compilation', function (compilation) {
    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      const files = [];

      chunks.forEach(function(chunk) {
        chunk.files.forEach(function(file) {
          files.push(file);
        });
      });

      compilation.additionalChunkAssets.forEach(function(file) {
        files.push(file);
      });

      files.filter(function(file) {
        return jsregex.test(file);
      }).forEach(function(file) {
        try {
          var asset = compilation.assets[file];

          // return cached version
          if (asset.__pubPathApplied) {
            compilation.assets[file] = asset.__pubPathApplied;
            return;
          }

          // grab source input
          var input = asset.source(),
              result;

          // replace define and requires
          if (options.expression) {
            result = input
              .replace(/__webpack_require__.p = (.*?)\;/, '__webpack_require__.p = function() { return ' + options.expression + ' };')
              .replace(/__webpack_require__.p \+/g, '__webpack_require__.p() +');
          } else {
            console.log('WARNING dynamic-pub-path-plugin: expression not specified!');
            result = input;
          }

          // save result
          asset.__pubPathApplied = compilation.assets[file] = new RawSource(result);
        } catch(e) {
          compilation.errors.push(e);
        }
      });

      callback();
    });
  });
};

module.exports = DynamicPubPathPlugin;
