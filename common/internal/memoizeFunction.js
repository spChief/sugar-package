'use strict';

var INTERNAL_MEMOIZE_LIMIT = require('../var/INTERNAL_MEMOIZE_LIMIT'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function memoizeFunction(fn) {
  var memo = {}, counter = 0;

  return function(key) {
    if (hasOwn(memo, key)) {
      return memo[key];
    }
    // istanbul ignore if
    if (counter === INTERNAL_MEMOIZE_LIMIT) {
      memo = {};
      counter = 0;
    }
    counter++;
    return memo[key] = fn(key);
  };
}

module.exports = memoizeFunction;