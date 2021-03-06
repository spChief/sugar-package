'use strict';

var classChecks = require('../var/classChecks');

var isString = classChecks.isString;

function escapeRegExp(str) {
  if (!isString(str)) str = String(str);
  return str.replace(/([\\/'*+?|()[\]{}.^$-])/g,'\\$1');
}

module.exports = escapeRegExp;