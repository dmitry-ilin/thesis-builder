exports.stubIdFilter = (env, source, filterName) => {
  env.addFilter(filterName, (nothing, id) => `{{ ${source} | ${filterName}('${id}') }}`);
};
exports.stubIdFunction = (functionName) => (id) => `{{ ${functionName}(${JSON.stringify(id)}) }}`;
