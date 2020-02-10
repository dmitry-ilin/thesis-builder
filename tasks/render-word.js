const knife = require('data-swissknife');
const { Remarkable } = require('remarkable');
const katex = require('remarkable-katex');
const nunjucks = require('nunjucks');
const classy = require('remarkable-classy');

const cheerio = require('cheerio');
const path = require('../utils/path');

const _ = knife.fp;

module.exports = async function renderWord() {
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

  const html = md.render(text);

  const $ = cheerio.load(html);
  _.each(_.range(1, 4), (i) => {
    $(`h${i}`).each(function () {
      $(this).html(`<span class="Heading${i}Char">${$(this).html()}</span>`);
    });
  });

  let previousList = null;
  let listNumber = 0;
  const unorderedLists = $('body').children('ul').map(function (i, eli) {
    if (this !== previousList) {
      listNumber += 1;
      previousList = this;
    }
    return $(this).find('li').map(function (j, elj) {
      const textNode = $(this).clone() // clone the element
        .children() // select all the children
        .remove() // remove all the children
        .end() // again go back to selected element
        .text();

      const level = $(this).parents('li').length;

      return `<p class=MsoListParagraphCxSpMiddle style='margin-left:${((level + 1) * 1.5)}cm;mso-add-space:auto;text-indent:-.25in;mso-list:l0 level${level + 1} lfo${listNumber}'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol;mso-bidi-font-family:Symbol'><span style='mso-list:Ignore'>¾<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span></span><![endif]><span class=SpellE>${textNode}</span></p>`;
    }).get()
      .join(' ');
  })
    .get();

  $('body').children('ul').each(function (i, eli) {
    $(unorderedLists[i]).insertAfter($(this));
  });
  $('body').children('ul').remove();


  const orderedLists = $('body').children('ol').map(function (i, eli) {
    if (this !== previousList) {
      listNumber += 1;
      previousList = this;
    }
    return $(this).find('li').map(function (j, elj) {
      const textNode = $(this).clone() // clone the element
        .children() // select all the children
        .remove() // remove all the children
        .end() // again go back to selected element
        .text();

      const level = $(this).parents('li').length;

      return `<p class=MsoListParagraphCxSpMiddle style='margin-left:${((level + 1) * 1.5)}cm;mso-add-space:auto;text-indent:-.25in;mso-list:l1 level${level + 1} lfo${listNumber}'><![if !supportLists]><span style='mso-fareast-font-family:"Times New Roman";mso-bidi-font-family:"Times New Roman"'><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;</span></span></span><![endif]><span class=SpellE>${textNode}</span></p>`;
    }).get()
      .join(' ');
  })
    .get();

  $('body').children('ol').each(function (i, eli) {
    $(orderedLists[i]).insertAfter($(this));
  });
  $('body').children('ol').remove();

  $('table td, table th')
    .attr('style', 'border:solid windowtext 1.0pt; mso-border-alt:solid windowtext .5pt;padding: 5pt 5pt 5pt 5pt');

  $('table td, table th').each(function (i, el) {
    $(this).html(`<p style='text-indent:0in;font-size:
    12.0pt;'>${$(this).html()}</p>`);
  });

  $('table')
    .attr('style', 'border-collapse:collapse;border:none;mso-border-alt:solid windowtext .5pt;mso-yfti-tbllook:1184;mso-padding-alt:0in 0in 0in 0in;align:center')
    .attr('border', 1)
    .attr('cellspacing', 0)
    .attr('cellpadding', 0)
    .after('<p>&nbsp;</p>')
    .each(function (i, el) {
      $(this)
        .prev('p')
        .attr('style', 'page-break-after:avoid;');
    });
  $('table').wrap('<div align=center></div>');

  $('p, li').addClass('MsoNormal');

  $('.img')
    .attr('style', 'margin-top:7.0pt;text-align:center;page-break-after:avoid;text-indent:0pt;')
    .removeClass('img');
  $('.img-caption')
    .attr('style', 'margin-bottom:7.0pt;text-align:center;text-indent:0pt;')
    .removeClass('img-caption');

  const wordRendered = nunjucks.render(path.configuredResolve('template.docx'), { content: $.html({ decodeEntities: false }) });
  const wordHeaderRendered = nunjucks.render(path.configuredResolve('template.docxHeader'), { });

  await knife.fs.outputFile(path.configuredResolve('outPath', 'docx/thesis.htm'), wordRendered);
  await knife.fs.outputFile(path.configuredResolve('outPath', 'docx/thesis_files/header.htm'), wordHeaderRendered);
};
