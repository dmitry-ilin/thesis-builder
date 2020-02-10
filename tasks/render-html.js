const knife = require('data-swissknife');
const { Remarkable } = require('remarkable');
const toc = require('markdown-toc');
const katex = require('remarkable-katex');
const nunjucks = require('nunjucks');
const classy = require('remarkable-classy');
const path = require('../utils/path');

module.exports = async function renderHtml() {
  const md = new Remarkable('full', {
    html: true,
    typographer: true,
    breaks: false,
    quotes: '«»',
  });
  md.use(katex);
  md.use(classy);

  const originalLinkValidator = md.inline.validateLink;
  const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;

  md.inline.validateLink = (url) => originalLinkValidator(url) || url.match(dataLinkRegex);
  md.inline.ruler.disable(['ins']);

  const textFile = await knife.storage.get('mergedTextWithAssetsAndReferences');
  const text = textFile.data.toString();

  const html = md.render(toc.insert(text));

  await knife.fs.outputFile(path.configuredResolve('outPath', 'html/thesis.html'), nunjucks.render(path.configuredResolve('template.html'), { content: html }));
};
