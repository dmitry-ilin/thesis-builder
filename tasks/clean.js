const knife = require('data-swissknife');

module.exports = async function clean() {
  return knife.storage.rm.all();
};
