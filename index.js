
const browserSync = require('browser-sync').create();

const config = require('config');

const tasks = {};

tasks.clean = require('./tasks/clean');
tasks.loadAssets = require('./tasks/load-assets');
tasks.injectAssets = require('./tasks/inject-assets');
tasks.injectRefs = require('./tasks/inject-refs');
tasks.mergeMd = require('./tasks/merge-md');
tasks.renderHtml = require('./tasks/render-html');
tasks.prerenderFigures = require('./tasks/prerender-figures');
tasks.prerenderTables = require('./tasks/prerender-tables');
tasks.renderWord = require('./tasks/render-word');
tasks.findTerms = require('./tasks/find-terms');


module.exports = (gulp) => {
  tasks.quickBuild = gulp.series(
    tasks.prerenderFigures,
    tasks.prerenderTables,
    tasks.mergeMd,
    tasks.loadAssets,
    tasks.injectAssets,
    tasks.injectRefs,
    tasks.renderHtml,
    tasks.renderWord
  );
  tasks.build = gulp.series(
    tasks.clean,
    tasks.quickBuild
  );


  tasks.watch = async () => {
    browserSync.init({
      server: {
        baseDir: `${config.get('outPath')}/html`,
        index: 'thesis.html',
      },
      open: false,
    });
    gulp.watch(`${config.get('outPath')}/html/thesis.html`)
      .on('change', () => {
        browserSync.reload('*');
      });

    return gulp.watch([
      `${config.get('srcPath')}/**`,
    ], gulp.series(tasks.quickBuild));
  };

  tasks.default = gulp.series(tasks.build, tasks.watch);

  return tasks;
};
