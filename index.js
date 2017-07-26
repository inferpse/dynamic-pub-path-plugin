const { SourceMapSource, RawSource } = require('webpack-sources'),
      babel = require('babel-core');

class DynamicPubPathPlugin {
  constructor(options) {
    this.options = Object.assign({
      jsregex: /\.js($|\?)/i,
      expression: null
    }, options);
  }
  apply(compiler) {
    const { options } = this,
          { jsregex } = options,
          useSourceMap = typeof options.sourceMap === 'undefined' ? !!compiler.options.devtool : options.sourceMap;

    compiler.plugin('compilation', function (compilation) {

      if (!options.expression) {
        compilation.errors.push(new Error('DynamicPubPathPlugin: public path expression is not specified in plugin options!'));
        return;
      }

      if (useSourceMap) {
        compilation.plugin('build-module', function (module) {
          module.useSourceMap = true;
        });
      }

      compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
        const files = [];

        chunks.forEach(chunk => {
          chunk.files.forEach(file => files.push(file));
        });

        compilation.additionalChunkAssets.forEach(file => files.push(file));

        files.filter(file => jsregex.test(file)).forEach(file => {
          try {
            let asset = compilation.assets[file];

            // use cached asset
            if (asset.__dynPubPathApplied) {
              compilation.assets[file] = asset.__dynPubPathApplied;
              return;
            }

            // read options
            let input, inputSourceMap;
            if (useSourceMap) {
              if (asset.sourceAndMap) {
                let sourceAndMap = asset.sourceAndMap();
                inputSourceMap = sourceAndMap.map;
                input = sourceAndMap.source;
              } else {
                inputSourceMap = asset.map();
                input = asset.source();
              }
            } else {
              input = asset.source();
            }

            // apply transformation
            const result = babel.transform(input, {
              plugins: [
                [TransformWebpackPublicPath, options]
              ],
              sourceMaps: useSourceMap,
              compact: false,
              babelrc: false,
              inputSourceMap
            });

            // save result
            asset.__dynPubPathApplied = compilation.assets[file] = (
              result.map
              ? new SourceMapSource(result.code, file, result.map, input, inputSourceMap)
              : new RawSource(result.code)
            );
          } catch (e) {
            compilation.errors.push(e);
          }
        });

        callback();
      })
    });
  }
}

const TransformWebpackPublicPath = ({types: t}) => {
  return {
    visitor: {
      Identifier: (path, {opts: options}) => {
        if (isWebpackPathIdentifier(path)) {
          if (isPathInitExpression(path)) {
            // replace "__webpack_require__.p = ..." with "__webpack_require__.p = function() { return ... }"
            if (!isPathInitReplaced(path)) {
              const assignmentPath = path.parentPath.parentPath;
              assignmentPath.replaceWithSourceString(`__webpack_require__.p = function() { return ${options.expression} }`);
            }
          } else {
            // replace "__webpack_require__.p" with "__webpack_require__.p()"
            if (!isPathUseReplaced(path)) {
              path.parentPath.replaceWith(t.callExpression(path.parentPath.node, []));
            }
          }
        }
      }
    }
  };

  function isWebpackPathIdentifier(path) {
    const { node, parentPath } = path;
    return node.name === 'p'
            && parentPath.isMemberExpression()
            && parentPath.get('object').node.name == '__webpack_require__';
  }

  function isPathInitExpression(path) {
    return path.parentPath.parentPath.isAssignmentExpression();
  }

  function isPathInitReplaced(path) {
    return path.parentPath.parentPath.node.right.type === 'FunctionExpression';
  }

  function isPathUseReplaced(path) {
    return path.parentPath.parentPath.node.type === 'CallExpression';
  }
}

module.exports = DynamicPubPathPlugin;
