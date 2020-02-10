const knife = require('data-swissknife');
const klaw = require('klaw-sync');
const YAML = require('yaml');
const Az = require('az');
const chalk = require('chalk');
const path = require('../utils/path');

const _ = knife.fp;

const ngrams = (a, n) => {
  if (n <= 1) {
    return a.map((smth) => ([smth]));
  }
  return a.slice(0, 1 - n).map((smth, i) => a.slice(i, i + n));
};

const loadFileContent = (dir, file) => knife.fs.readFileSync(path.resolve(dir, file)).toString();

const findReplacement = (term, key, entry) => {
  let replacement = '';
  _.each(term, (form, termForm) => {
    _.each(form, (nmbr, termNmbr) => {
      _.each(nmbr, (wording, termCase) => {
        if (!replacement && wording.toLowerCase() === entry.toLowerCase()) {
          replacement = `{{ def('${key}', '${termForm}', '${termNmbr}', '${termCase}') }}`;
        }
      });
    });
  });

  return replacement || '?';
};

module.exports = async function findTerms() {
  await new Promise((resolve) => {
    Az.Morph.init('node_modules/az/dicts', resolve);
  });
  const indexWithAssets = JSON.parse((await knife.storage.get('indexWithAssets')).data.toString());

  const allDirs = _.map(klaw(path.configuredResolve('srcPath', 'texts'), { nofile: true }), 'path');

  const texts = _.flatMap(allDirs, (dir) => {
    if (!knife.fs.existsSync(path.resolve(dir, 'index.yml'))) {
      return [];
    }

    const indexFile = {
      path: path.resolve(dir, 'index.yml'),
      content: YAML.parse(loadFileContent(dir, 'index.yml')).heading,
    };

    const textFiles = _.map(
      _.filter(knife.fs.readdirSync(dir), (file) => _.endsWith(file, '.md.njk')),
      (file) => ({
        path: path.resolve(dir, file),
        content: loadFileContent(dir, file),
      })
    );

    return [indexFile, ...textFiles];
  });

  const nunjucksFreeText = _.map(texts, (text) => ({
    path: text.path,
    originalContent: _.replace(text.content, /{{(.*?)}}/ig, '').toLowerCase(),
    content: _.map(Az.Tokens(_.replace(text.content, /{{(.*?)}}/ig, '')
      .toLowerCase()).done(['WORD']), (t) => t.toString()),
  }));
  // console.log(_.take(_.map(nunjucksFreeText, 'content'), 10));
  // return;

  const needles = _.map(indexWithAssets.definitions, (definition, key) => {
    const variants = _.flatMap(definition.term, (form) => {
      const list = _.compact(_.flatMap(form, (nmbr) => _.values(nmbr)));
      return list;
    });

    return {
      key,
      term: definition.term.default.sing.nomn,
      variants: _.map(_.uniq(variants), (v) => _.map(Az.Tokens(v).done(['WORD']), (t) => t.toString().toLowerCase())),
    };
  });

  let totalMatches = 0;
  const affectedFiles = [];
  const possibleTerms = [];
  _.each(nunjucksFreeText, (text) => {
    _.each(needles, (needle) => {
      _.each(needle.variants, (variant) => {
        const splitted = ngrams(text.content, variant.length);
        // console.log(variant);
        // console.log(_.first(splitted));

        if (!_.some(splitted, (words) => _.isEqual(words.join(), variant.join()))) {
          return;
        }
        const joinedVariant = _.join(variant, ' ');

        console.log(chalk.bold(chalk.yellow(needle.term)));
        console.log(chalk.yellow(text.path));

        const splittedOriginal = _.split(text.originalContent, joinedVariant);
        if (splittedOriginal.length > 1) {
          const merged = _.join(
            splittedOriginal,
            `${chalk.bold(chalk.red(joinedVariant))} ${
              chalk.bold(chalk.green(findReplacement(indexWithAssets.definitions[needle.key].term, needle.key, joinedVariant)))}`
          );

          const lines = _.split(merged, '\n');
          _.each(lines, (line, i) => {
            if (_.split(line, joinedVariant).length > 1) {
              totalMatches += 1;
              affectedFiles.push(text.path);
              possibleTerms.push(needle.term);
              console.log(`${i + 1}: ${line}`);
            }
          });
          console.log('');
        }
      });
    });
  });
  console.log(chalk.bold(chalk.whiteBright(`Total possible matches: ${totalMatches}`)));
  console.log(chalk.bold(chalk.whiteBright(`Affected files: ${_.uniq(affectedFiles).length}`)));
  console.log(chalk.bold(chalk.whiteBright(`Possibly unlinked terms: \n\t${_.join(_.uniq(possibleTerms), '\n\t')}`)));

  // await knife.storage.put('mergedText', _.join(texts, '\n\n'));
};
