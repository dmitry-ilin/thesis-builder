const config = require('config');
const path = require('path');
const pkgDir = require('pkg-dir');
const _ = require('data-swissknife').fp;

const rootPath = pkgDir.sync();

module.exports = _.assignIn(path, {
  configuredResolve: (configPath, ...rest) => {
    if (!_.isEmpty(rest)) {
      return path.resolve(rootPath, config.get(configPath), ...rest);
    }
    return path.resolve(rootPath, config.get(configPath));
  },
});
