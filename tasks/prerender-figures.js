const knife = require('data-swissknife');
const path = require('path');
const config = require('config');
const { execSync } = require('child_process');
const Jimp = require('jimp');
const src2img = require('src2img');
const YAML = require('yaml');
const hasha = require('hasha');

const klaw = require('klaw-sync');


const _ = knife.fp;

module.exports = async function prerenderFigures() {
  const cache = await knife.storage.get.info('figures');
  let figures = {};
  if (cache) {
    const storedFigures = await knife.storage.get('figures');
    figures = JSON.parse(storedFigures.data.toString());
  }


  const allFiles = klaw(path.configuredResolve('srcPath', 'figures'), { nodir: true });

  const indices = _.filter(allFiles, (file) => (path.basename(file.path) === 'index.yml'));

  const drawIoPath = path.resolve(config.get('drawio.path'));

  await _.reduce(indices, async (acc, index) => {
    await acc;
    const figure = YAML.parse(knife.fs.readFileSync(index.path).toString());
    let content;
    const figurePath = path.resolve(path.parse(index.path).dir, figure.path);

    const name = path.basename(path.parse(index.path).dir);
    const hash = await hasha.fromFile(figurePath, { algorithm: 'md5' });

    figures[name] = _.assignIn({}, figures[name], figure);

    if (_.get(figures, [name, 'hash']) === hash) {
      return;
    }

    if (figure.type === 'image') {
      content = knife.fs.readFileSync(figurePath);
    }
    if (figure.type === 'drawio') {
      execSync(`"${drawIoPath}" -x -f png -s 2 -o "${figurePath}.png" "${figurePath}"`);
      content = knife.fs.readFileSync(`${figurePath}.png`);
      knife.fs.removeSync(`${figurePath}.png`);
    }
    if (figure.type === 'code') {
      content = _.first(await src2img({
        fontSize: 48,
        fontSizeUnit: 'pt',
        padding: 48,
        paddingUnit: 'px',
        type: 'png',
        fontFamily: '"Lucida Console", Monaco, monospace',
        src: [[knife.fs.readFileSync(figurePath).toString(), figure.language || 'clike']],
      }));
    }

    const image = await Jimp.read(content);

    const maxWidth = config.get('figure.maxWidth');
    const maxHeight = config.get('figure.maxHeight');

    image.quality(100);
    if (image.getWidth() > maxWidth || image.getHeight() > maxHeight) {
      image.scaleToFit(maxWidth, maxHeight);
    }
    content = await image.getBufferAsync(Jimp.MIME_PNG);

    figures[name] = _.assignIn({}, figures[name], {
      content: Buffer.from(content).toString('base64'),
      hash,
    });
  }, Promise.resolve());


  await knife.storage.put('figures', JSON.stringify(figures));
};
