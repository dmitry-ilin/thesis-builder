const knife = require('data-swissknife');
const klaw = require('klaw-sync');
const YAML = require('yaml');
const path = require('../utils/path');

const _ = knife.fp;

const loadFileContent = (dir, file) => knife.fs.readFileSync(path.resolve(dir, file)).toString();

module.exports = async function mergeMd() {
  const allDirs = _.map(klaw(path.configuredResolve('srcPath', 'texts'), { nofile: true }), 'path');

  const rootPath = path.configuredResolve('srcPath', 'texts').split(path.sep);

  const texts = _.flatMap(allDirs, (dir) => {
    if (!knife.fs.existsSync(path.resolve(dir, 'index.yml'))) {
      return [];
    }

    const index = YAML.parse(loadFileContent(dir, 'index.yml'));

    const textFiles = _.map(
      _.filter(knife.fs.readdirSync(dir), (file) => _.endsWith(file, '.md.njk')),
      (file) => loadFileContent(dir, file)
    );

    const level = path.resolve(dir).split(path.sep).length - rootPath.length;

    return [`${_.repeat('#', level)} ${index.heading}`, ...textFiles];
  });

  await knife.storage.put('mergedText', _.join(texts, '\n\n'));
};
