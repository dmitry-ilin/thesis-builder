const knife = require('data-swissknife');
const nunjucks = require('nunjucks');
const markdownTable = require('markdown-table');
const csv = require('csv/lib/sync');
const utils = require('../utils/nunjucks');

const env = new nunjucks.Environment();
env.opts.autoescape = false;

// console.log(csvToMd)

const _ = knife.fp;

module.exports = async function injectAssets() {
  const textFile = await knife.storage.get('mergedText');
  const text = textFile.data.toString();
  const indexFile = await knife.storage.get('indexWithAssets');
  const index = JSON.parse(indexFile.data.toString());

  // Figures
  let figureNumber = 0;
  const figure = (figureId) => {
    figureNumber += 1;
    index.figures[figureId].number = figureNumber;

    const img = `![Рисунок ${index.figures[figureId].number} -- ${index.figures[figureId].title}]\
(data:image/png;base64,${index.figures[figureId].content}){img}`;
    const label = `Рисунок ${index.figures[figureId].number} -- ${index.figures[figureId].title}{img-caption}`;

    return `${img}\n\n${label}\n`;
  };
  const figureRef = utils.stubIdFunction('figureRef');

  // Tables
  let tableNumber = 0;
  const table = (tableId, hasHeader) => {
    tableNumber += 1;
    index.tables[tableId].number = tableNumber;

    const label = `Таблица ${index.tables[tableId].number} -- ${index.tables[tableId].title}`;
    const tbl = markdownTable(csv.parse(index.tables[tableId].content, { bom: true }));

    return `${label}\n\n${tbl}\n`;
  };
  const tableRef = utils.stubIdFunction('tableRef');


  // Citations
  const orderedCitations = [];
  const cite = (ids) => {
    const arrIds = _.castArray(ids);
    _.each(arrIds, (id) => {
      const newItem = _.find(index.citations, ['id', id]);
      if (_.find(orderedCitations, (oc) => (oc.id === newItem.id))) {
        return;
      }
      orderedCitations.push(newItem);
    });

    return utils.stubIdFunction('cite')(ids);
  };
  const bibliography = utils.stubIdFunction('bibliography');

  // Definitions
  const introducedDefinitions = {};
  const definition = (definitionName, variant, num, form) => {
    introducedDefinitions[definitionName] = index.definitions[definitionName];
    return index.definitions[definitionName].term[variant][num || 'sing'][form || 'nomn'];
  };
  const glossary = utils.stubIdFunction('glossary');

  // Variables
  const introducedVariables = {};
  const variable = (variableName) => {
    introducedVariables[variableName] = index.variables[variableName];
    return index.variables[variableName];
  };

  // Utils
  const todo = (label) => `**TODO**: ${label}{ui orange message}`;

  const mergedTextWithAssets = env.renderString(text, {
    figures: index.figures,
    tables: index.tables,
    formulas: index.formulas,
    citations: index.citations,

    figure,
    figureRef,
    table,
    tableRef,
    cite,
    bibliography,
    definition,
    def: definition,
    glossary,
    variable,
    todo,
  });

  index.citations = orderedCitations;
  index.definitions = introducedDefinitions;

  await knife.storage.put('mergedTextWithAssets', mergedTextWithAssets);
  await knife.storage.put('indexWithAssetNumbering', JSON.stringify(index));
};
