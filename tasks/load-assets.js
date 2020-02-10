const knife = require('data-swissknife');
const Az = require('az');
const Cite = require('citation-js');
const path = require('../utils/path');


const _ = knife.fp;

const CAseList = ['nomn', 'gent', 'datv', 'accs', 'ablt', 'loct'];
const NMbrList = ['sing', 'plur'];

module.exports = async function loadAssets() {
  await new Promise((resolve) => {
    Az.Morph.init('node_modules/az/dicts', resolve);
  });
  const index = {};

  index.variables = await knife.readToJSON(path.configuredResolve('srcPath', 'variables'));

  const definitions = await knife.readToJSON(path.configuredResolve('srcPath', 'definitions'));

  index.definitions = _.mapValues(definitions, (definition) => {
    const morphs = _.mapValues(definition.term, (term, termKey) => _.zipObject(NMbrList, _.map(NMbrList, (NMbr) => {
      if (_.isObject(term[NMbr])) {
        return term[NMbr];
      }
      const initialTokens = Az.Tokens(term[NMbr]).done();
      const tokens = _.map(initialTokens, (token) => token.toString());

      const paradigms = _.map(CAseList, (CAse) => {
        if (termKey === 'short') { // Return abbreviations AS IS
          return _.join(tokens, '');
        }

        let noNomnNOUN = !_.isEmpty(tokens) && !_.some(tokens, (token) => {
          const bestParadigm = Az.Morph(token)[0];
          return (bestParadigm && bestParadigm.tag.NOUN && bestParadigm.tag.nomn);
        });

        return _.join(_.map(tokens, (token) => {
          let bestParadigm = _.first(Az.Morph(token));

          // If there is no nomn noun, taking the second best guess for the first noun.
          if (bestParadigm && bestParadigm.tag.NOUN && noNomnNOUN) {
            noNomnNOUN = false;
            bestParadigm = _.get(Az.Morph(token), 1);
          }

          if (bestParadigm && bestParadigm.tag.nomn) {
            const options = [CAse, NMbr];
            if (NMbr === 'sing') {
              options.push(bestParadigm.tag.GNdr);
            }
            return bestParadigm.inflect(options).toString();
          }
          return token.toString();
        }), '');
      });
      return _.zipObject(CAseList, paradigms);
    })));

    return {
      description: definition.description,
      term: morphs,
    };
  });

  const storedFigures = await knife.storage.get('figures');
  index.figures = JSON.parse(storedFigures.data.toString());

  const storedTables = await knife.storage.get('tables');
  index.tables = JSON.parse(storedTables.data.toString());

  const gostFile = knife.fs.readFileSync(path.configuredResolve('template.bibliography'));
  const gost = Buffer.from(gostFile).toString();
  const cslConfig = Cite.plugins.config.get('@csl');
  cslConfig.templates.add('gost', gost);

  const cite = new Cite();
  _.each(knife.fs.readdirSync(path.configuredResolve('srcPath', 'citations')), (file) => {
    const citationFile = knife.fs.readFileSync(path.configuredResolve('srcPath', 'citations', file));
    cite.add(Buffer.from(citationFile).toString());
  });

  index.citations = JSON.parse(cite.format('data'));

  await knife.storage.put('indexWithAssets', JSON.stringify(index));
};
