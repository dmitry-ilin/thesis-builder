const knife = require('data-swissknife');
const nunjucks = require('nunjucks');
const Cite = require('citation-js');
const groupNumbers = require('group-numbers');

const env = new nunjucks.Environment();
env.opts.autoescape = false;
env.opts.noCache = false;


const _ = knife.fp;

module.exports = async function loadRefs() {
  const textFile = await knife.storage.get('mergedTextWithAssets');
  const text = textFile.data.toString();
  const indexFile = await knife.storage.get('indexWithAssetNumbering');
  const index = JSON.parse(indexFile.data.toString());

  // Figures
  const figureRef = (figureId) => index.figures[figureId].number;

  // Tables
  const tableRef = (tableId) => index.tables[tableId].number;

  // Citations
  const cite = (ids) => {
    const arrIds = _.castArray(ids);
    const numbers = _.map(arrIds, (id) => (_.findIndex(index.citations, (val) => (val.id == id)) + 1));

    const groups = groupNumbers(_.sortBy(numbers), false);
    const rangedGroups = _.map(
      groups,
      (group) => (group.length > 2 ? `${_.first(group)}-${_.last(group)}` : _.join(group, ', '))
    );

    return `[${_.join(rangedGroups, ', ')}]`;
  };
  const bibliography = () => {
    const citations = new Cite(index.citations);
    const links = _.split(citations.format('bibliography', { format: 'text', template: 'gost', lang: 'ru-RU' }), '\n');

    const stripLinkNumber = (link) => _.join(_.tail(_.split(link, '. ')), '. ');

    return _.join(_.map(
      links,
      (link) => `[${link}](https://scholar.google.com/scholar?q=${encodeURIComponent(stripLinkNumber(link))})`
    ), '\n\n');
  };

  // Definitions
  const definition = (definitionName, variant, num, form) => index.definitions[definitionName].term[variant][num || 'sing'][form || 'nomn'];

  const glossary = () => {
    const definitions = _.sortBy(_.values(index.definitions), 'term.default.sing.nomn');

    return _.join(_.map(
      definitions,
      (def) => {
        const full = _.upperFirst(def.term.default.sing.nomn);
        const short = def.term.short ? ` (${def.term.short.sing.nomn})` : '';
        return `*${full}${short}* -- ${def.description}`;
      }
    ), '\n\n');
  };

  const textWithRefs = env.renderString(text, {
    figures: index.figures,
    tables: index.tables,
    formulas: index.formulas,
    citations: index.citations,

    figureRef,
    tableRef,
    cite,
    bibliography,
    definition,
    def: definition,
    glossary,
  });

  await knife.storage.put('mergedTextWithAssetsAndReferences', textWithRefs);
};
