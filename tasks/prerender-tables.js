const knife = require('data-swissknife');
const path = require('path');
const YAML = require('yaml');
const hasha = require('hasha');

const klaw = require('klaw-sync');


const _ = knife.fp;

module.exports = async function prerenderTables() {
  const cache = await knife.storage.get.info('tables');
  let tables = {};
  if (cache) {
    const storedTables = await knife.storage.get('tables');
    tables = JSON.parse(storedTables.data.toString());
  }


  const allFiles = klaw(path.configuredResolve('srcPath', 'tables'), { nodir: true });

  const indices = _.filter(allFiles, (file) => (path.basename(file.path) === 'index.yml'));

  await _.reduce(indices, async (acc, index) => {
    await acc;
    const table = YAML.parse(knife.fs.readFileSync(index.path).toString());
    let content;
    const tablePath = path.resolve(path.parse(index.path).dir, table.path);

    const name = path.basename(path.parse(index.path).dir);
    const hash = await hasha.fromFile(tablePath, { algorithm: 'md5' });

    tables[name] = _.assignIn({}, tables[name], table);

    if (_.get(tables, [name, 'hash']) === hash) {
      return;
    }

    if (table.type === 'csv') {
      content = knife.fs.readFileSync(tablePath).toString();
    }

    tables[name] = _.assignIn({}, tables[name], {
      content,
      hash,
    });
  }, Promise.resolve());


  await knife.storage.put('tables', JSON.stringify(tables));
};
