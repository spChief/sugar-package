'use strict';

var Range = require('./internal/Range'),
    rangeEvery = require('./internal/rangeEvery'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'every': function(amount, everyFn) {
    return rangeEvery(this, amount, false, everyFn);
  }

});

// This package does not export anything as it is
// simply defining "every" on Range.prototype.