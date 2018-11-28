/*
 *  Sugar v2.0.5
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

  

  // The global to export.
  var Sugar;

  // The name of Sugar in the global namespace.
  var SUGAR_GLOBAL = 'Sugar';

  // Natives available on initialization. Letting Object go first to ensure its
  // global is set by the time the rest are checking for chainable Object methods.
  var NATIVE_NAMES = 'Object Number String Array Date RegExp Function';

  // Static method flag
  var STATIC   = 0x1;

  // Instance method flag
  var INSTANCE = 0x2;

  // IE8 has a broken defineProperty but no defineProperties so this saves a try/catch.
  var PROPERTY_DESCRIPTOR_SUPPORT = !!(Object.defineProperty && Object.defineProperties);

  var globalContext = getGlobal();

  // Whether object instance methods can be mapped to the prototype.
  var allowObjectPrototype = false;

  // A map from Array to SugarArray.
  var namespacesByName = {};

  // A map from [object Object] to namespace.
  var namespacesByClassString = {};

  // Defining properties.
  // istanbul ignore next
  var defineProperty = PROPERTY_DESCRIPTOR_SUPPORT ?  Object.defineProperty : definePropertyShim;

  // A default chainable class for unknown types.
  var DefaultChainable = getNewChainableClass('Chainable');


  // Global methods

  function getGlobal() {
    // Get global context by keyword here to avoid issues with libraries
    // that can potentially alter this script's context object.
    return testGlobal(typeof global !== 'undefined' && global) ||
           testGlobal(typeof window !== 'undefined' && window);
  }

  function testGlobal(obj) {
    // Note that Rhino uses a different "global" keyword so perform an
    // extra check here to ensure that it's actually the global object.
    return obj && obj.Object === Object ? obj : null;
  }

  function setupGlobal() {
    Sugar = globalContext[SUGAR_GLOBAL];
    // istanbul ignore if
    if (Sugar) {
      // Reuse already defined Sugar global object.
      return;
    }
    Sugar = function(arg) {
      forEachProperty(Sugar, function(sugarNamespace, name) {
        // Although only the only enumerable properties on the global
        // object are Sugar namespaces, environments that can't set
        // non-enumerable properties will step through the utility methods
        // as well here, so use this check to only allow true namespaces.
        if (hasOwn(namespacesByName, name)) {
          sugarNamespace.extend(arg);
        }
      });
      return Sugar;
    };
    // istanbul ignore else
    if (typeof module !== 'undefined' && module.exports) {
      // Node or webpack environment
      module.exports = Sugar;
    } else {
      // Unwrapped browser environment
      try {
        globalContext[SUGAR_GLOBAL] = Sugar;
      } catch (e) {
        // Contexts such as QML have a read-only global context.
      }
    }
    forEachProperty(NATIVE_NAMES.split(' '), function(name) {
      createNamespace(name);
    });
    setGlobalProperties();
  }

  
  function createNamespace(name) {

    // Is the current namespace Object?
    var isObject = name === 'Object';

    // A Sugar namespace is also a chainable class: Sugar.Array, etc.
    var sugarNamespace = getNewChainableClass(name, true);

    
    var extend = function (opts) {

      var nativeClass = globalContext[name], nativeProto = nativeClass.prototype;
      var staticMethods = {}, instanceMethods = {}, methodsByName;

      function objectRestricted(name, target) {
        return isObject && target === nativeProto &&
               (!allowObjectPrototype || name === 'get' || name === 'set');
      }

      function arrayOptionExists(field, val) {
        var arr = opts[field];
        if (arr) {
          for (var i = 0, el; el = arr[i]; i++) {
            if (el === val) {
              return true;
            }
          }
        }
        return false;
      }

      function arrayOptionExcludes(field, val) {
        return opts[field] && !arrayOptionExists(field, val);
      }

      function disallowedByFlags(methodName, target, flags) {
        // Disallowing methods by flag currently only applies if methods already
        // exist to avoid enhancing native methods, as aliases should still be
        // extended (i.e. Array#all should still be extended even if Array#every
        // is being disallowed by a flag).
        if (!target[methodName] || !flags) {
          return false;
        }
        for (var i = 0; i < flags.length; i++) {
          if (opts[flags[i]] === false) {
            return true;
          }
        }
      }

      function namespaceIsExcepted() {
        return arrayOptionExists('except', nativeClass) ||
               arrayOptionExcludes('namespaces', nativeClass);
      }

      function methodIsExcepted(methodName) {
        return arrayOptionExists('except', methodName);
      }

      function canExtend(methodName, method, target) {
        return !objectRestricted(methodName, target) &&
               !disallowedByFlags(methodName, target, method.flags) &&
               !methodIsExcepted(methodName);
      }

      opts = opts || {};
      methodsByName = opts.methods;

      if (namespaceIsExcepted()) {
        return;
      } else if (isObject && typeof opts.objectPrototype === 'boolean') {
        // Store "objectPrototype" flag for future reference.
        allowObjectPrototype = opts.objectPrototype;
      }

      forEachProperty(methodsByName || sugarNamespace, function(method, methodName) {
        if (methodsByName) {
          // If we have method names passed in an array,
          // then we need to flip the key and value here
          // and find the method in the Sugar namespace.
          methodName = method;
          method = sugarNamespace[methodName];
        }
        if (hasOwn(method, 'instance') && canExtend(methodName, method, nativeProto)) {
          instanceMethods[methodName] = method.instance;
        }
        if(hasOwn(method, 'static') && canExtend(methodName, method, nativeClass)) {
          staticMethods[methodName] = method;
        }
      });

      // Accessing the extend target each time instead of holding a reference as
      // it may have been overwritten (for example Date by Sinon). Also need to
      // access through the global to allow extension of user-defined namespaces.
      extendNative(nativeClass, staticMethods);
      extendNative(nativeProto, instanceMethods);

      if (!methodsByName) {
        // If there are no method names passed, then
        // all methods in the namespace will be extended
        // to the native. This includes all future defined
        // methods, so add a flag here to check later.
        setProperty(sugarNamespace, 'active', true);
      }
      return sugarNamespace;
    };

    function defineWithOptionCollect(methodName, instance, args) {
      setProperty(sugarNamespace, methodName, function(arg1, arg2, arg3) {
        var opts = collectDefineOptions(arg1, arg2, arg3);
        defineMethods(sugarNamespace, opts.methods, instance, args, opts.last);
        return sugarNamespace;
      });
    }

    
    defineWithOptionCollect('defineStatic', STATIC);

    
    defineWithOptionCollect('defineInstance', INSTANCE);

    
    defineWithOptionCollect('defineInstanceAndStatic', INSTANCE | STATIC);


    
    defineWithOptionCollect('defineStaticWithArguments', STATIC, true);

    
    defineWithOptionCollect('defineInstanceWithArguments', INSTANCE, true);

    
    setProperty(sugarNamespace, 'defineStaticPolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name], opts.methods, true, opts.last);
      return sugarNamespace;
    });

    
    setProperty(sugarNamespace, 'defineInstancePolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name].prototype, opts.methods, true, opts.last);
      // Map instance polyfills to chainable as well.
      forEachProperty(opts.methods, function(fn, methodName) {
        defineChainableMethod(sugarNamespace, methodName, fn);
      });
      return sugarNamespace;
    });

    
    setProperty(sugarNamespace, 'alias', function(name, source) {
      var method = typeof source === 'string' ? sugarNamespace[source] : source;
      setMethod(sugarNamespace, name, method);
      return sugarNamespace;
    });

    // Each namespace can extend only itself through its .extend method.
    setProperty(sugarNamespace, 'extend', extend);

    // Cache the class to namespace relationship for later use.
    namespacesByName[name] = sugarNamespace;
    namespacesByClassString['[object ' + name + ']'] = sugarNamespace;

    mapNativeToChainable(name);
    mapObjectChainablesToNamespace(sugarNamespace);


    // Export
    return Sugar[name] = sugarNamespace;
  }

  function setGlobalProperties() {
    setProperty(Sugar, 'VERSION', '2.0.5');
    setProperty(Sugar, 'extend', Sugar);
    setProperty(Sugar, 'toString', toString);
    setProperty(Sugar, 'createNamespace', createNamespace);

    setProperty(Sugar, 'util', {
      'hasOwn': hasOwn,
      'getOwn': getOwn,
      'setProperty': setProperty,
      'classToString': classToString,
      'defineProperty': defineProperty,
      'forEachProperty': forEachProperty,
      'mapNativeToChainable': mapNativeToChainable
    });
  }

  function toString() {
    return SUGAR_GLOBAL;
  }


  // Defining Methods

  function defineMethods(sugarNamespace, methods, type, args, flags) {
    forEachProperty(methods, function(method, methodName) {
      var instanceMethod, staticMethod = method;
      if (args) {
        staticMethod = wrapMethodWithArguments(method);
      }
      if (flags) {
        staticMethod.flags = flags;
      }

      // A method may define its own custom implementation, so
      // make sure that's not the case before creating one.
      if (type & INSTANCE && !method.instance) {
        instanceMethod = wrapInstanceMethod(method, args);
        setProperty(staticMethod, 'instance', instanceMethod);
      }

      if (type & STATIC) {
        setProperty(staticMethod, 'static', true);
      }

      setMethod(sugarNamespace, methodName, staticMethod);

      if (sugarNamespace.active) {
        // If the namespace has been activated (.extend has been called),
        // then map this method as well.
        sugarNamespace.extend(methodName);
      }
    });
  }

  function collectDefineOptions(arg1, arg2, arg3) {
    var methods, last;
    if (typeof arg1 === 'string') {
      methods = {};
      methods[arg1] = arg2;
      last = arg3;
    } else {
      methods = arg1;
      last = arg2;
    }
    return {
      last: last,
      methods: methods
    };
  }

  function wrapInstanceMethod(fn, args) {
    return args ? wrapMethodWithArguments(fn, true) : wrapInstanceMethodFixed(fn);
  }

  function wrapMethodWithArguments(fn, instance) {
    // Functions accepting enumerated arguments will always have "args" as the
    // last argument, so subtract one from the function length to get the point
    // at which to start collecting arguments. If this is an instance method on
    // a prototype, then "this" will be pushed into the arguments array so start
    // collecting 1 argument earlier.
    var startCollect = fn.length - 1 - (instance ? 1 : 0);
    return function() {
      var args = [], collectedArgs = [], len;
      if (instance) {
        args.push(this);
      }
      len = Math.max(arguments.length, startCollect);
      // Optimized: no leaking arguments
      for (var i = 0; i < len; i++) {
        if (i < startCollect) {
          args.push(arguments[i]);
        } else {
          collectedArgs.push(arguments[i]);
        }
      }
      args.push(collectedArgs);
      return fn.apply(this, args);
    };
  }

  function wrapInstanceMethodFixed(fn) {
    switch(fn.length) {
      // Wrapped instance methods will always be passed the instance
      // as the first argument, but requiring the argument to be defined
      // may cause confusion here, so return the same wrapped function regardless.
      case 0:
      case 1:
        return function() {
          return fn(this);
        };
      case 2:
        return function(a) {
          return fn(this, a);
        };
      case 3:
        return function(a, b) {
          return fn(this, a, b);
        };
      case 4:
        return function(a, b, c) {
          return fn(this, a, b, c);
        };
      case 5:
        return function(a, b, c, d) {
          return fn(this, a, b, c, d);
        };
    }
  }

  // Method helpers

  function extendNative(target, source, polyfill, override) {
    forEachProperty(source, function(method, name) {
      if (polyfill && !override && target[name]) {
        // Method exists, so bail.
        return;
      }
      setProperty(target, name, method);
    });
  }

  function setMethod(sugarNamespace, methodName, method) {
    sugarNamespace[methodName] = method;
    if (method.instance) {
      defineChainableMethod(sugarNamespace, methodName, method.instance, true);
    }
  }


  // Chainables

  function getNewChainableClass(name) {
    var fn = function SugarChainable(obj, arg) {
      if (!(this instanceof fn)) {
        return new fn(obj, arg);
      }
      if (this.constructor !== fn) {
        // Allow modules to define their own constructors.
        obj = this.constructor.apply(obj, arguments);
      }
      this.raw = obj;
    };
    setProperty(fn, 'toString', function() {
      return SUGAR_GLOBAL + name;
    });
    setProperty(fn.prototype, 'valueOf', function() {
      return this.raw;
    });
    return fn;
  }

  function defineChainableMethod(sugarNamespace, methodName, fn) {
    var wrapped = wrapWithChainableResult(fn), existing, collision, dcp;
    dcp = DefaultChainable.prototype;
    existing = dcp[methodName];

    // If the method was previously defined on the default chainable, then a
    // collision exists, so set the method to a disambiguation function that will
    // lazily evaluate the object and find it's associated chainable. An extra
    // check is required to avoid false positives from Object inherited methods.
    collision = existing && existing !== Object.prototype[methodName];

    // The disambiguation function is only required once.
    if (!existing || !existing.disambiguate) {
      dcp[methodName] = collision ? disambiguateMethod(methodName) : wrapped;
    }

    // The target chainable always receives the wrapped method. Additionally,
    // if the target chainable is Sugar.Object, then map the wrapped method
    // to all other namespaces as well if they do not define their own method
    // of the same name. This way, a Sugar.Number will have methods like
    // isEqual that can be called on any object without having to traverse up
    // the prototype chain and perform disambiguation, which costs cycles.
    // Note that the "if" block below actually does nothing on init as Object
    // goes first and no other namespaces exist yet. However it needs to be
    // here as Object instance methods defined later also need to be mapped
    // back onto existing namespaces.
    sugarNamespace.prototype[methodName] = wrapped;
    if (sugarNamespace === Sugar.Object) {
      mapObjectChainableToAllNamespaces(methodName, wrapped);
    }
  }

  function mapObjectChainablesToNamespace(sugarNamespace) {
    forEachProperty(Sugar.Object && Sugar.Object.prototype, function(val, methodName) {
      if (typeof val === 'function') {
        setObjectChainableOnNamespace(sugarNamespace, methodName, val);
      }
    });
  }

  function mapObjectChainableToAllNamespaces(methodName, fn) {
    forEachProperty(namespacesByName, function(sugarNamespace) {
      setObjectChainableOnNamespace(sugarNamespace, methodName, fn);
    });
  }

  function setObjectChainableOnNamespace(sugarNamespace, methodName, fn) {
    var proto = sugarNamespace.prototype;
    if (!hasOwn(proto, methodName)) {
      proto[methodName] = fn;
    }
  }

  function wrapWithChainableResult(fn) {
    return function() {
      return new DefaultChainable(fn.apply(this.raw, arguments));
    };
  }

  function disambiguateMethod(methodName) {
    var fn = function() {
      var raw = this.raw, sugarNamespace;
      if (raw != null) {
        // Find the Sugar namespace for this unknown.
        sugarNamespace = namespacesByClassString[classToString(raw)];
      }
      if (!sugarNamespace) {
        // If no sugarNamespace can be resolved, then default
        // back to Sugar.Object so that undefined and other
        // non-supported types can still have basic object
        // methods called on them, such as type checks.
        sugarNamespace = Sugar.Object;
      }

      return new sugarNamespace(raw)[methodName].apply(this, arguments);
    };
    fn.disambiguate = true;
    return fn;
  }

  function mapNativeToChainable(name, methodNames) {
    var sugarNamespace = namespacesByName[name],
        nativeProto = globalContext[name].prototype;

    if (!methodNames && ownPropertyNames) {
      methodNames = ownPropertyNames(nativeProto);
    }

    forEachProperty(methodNames, function(methodName) {
      if (nativeMethodProhibited(methodName)) {
        // Sugar chainables have their own constructors as well as "valueOf"
        // methods, so exclude them here. The __proto__ argument should be trapped
        // by the function check below, however simply accessing this property on
        // Object.prototype causes QML to segfault, so pre-emptively excluding it.
        return;
      }
      try {
        var fn = nativeProto[methodName];
        if (typeof fn !== 'function') {
          // Bail on anything not a function.
          return;
        }
      } catch (e) {
        // Function.prototype has properties that
        // will throw errors when accessed.
        return;
      }
      defineChainableMethod(sugarNamespace, methodName, fn);
    });
  }

  function nativeMethodProhibited(methodName) {
    return methodName === 'constructor' ||
           methodName === 'valueOf' ||
           methodName === '__proto__';
  }


  // Util

  // Internal references
  var ownPropertyNames = Object.getOwnPropertyNames,
      internalToString = Object.prototype.toString,
      internalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Defining this as a variable here as the ES5 module
  // overwrites it to patch DONTENUM.
  var forEachProperty = function (obj, fn) {
    for(var key in obj) {
      if (!hasOwn(obj, key)) continue;
      if (fn.call(obj, obj[key], key, obj) === false) break;
    }
  };

  // istanbul ignore next
  function definePropertyShim(obj, prop, descriptor) {
    obj[prop] = descriptor.value;
  }

  function setProperty(target, name, value, enumerable) {
    defineProperty(target, name, {
      value: value,
      enumerable: !!enumerable,
      configurable: true,
      writable: true
    });
  }

  // PERF: Attempts to speed this method up get very Heisenbergy. Quickly
  // returning based on typeof works for primitives, but slows down object
  // types. Even === checks on null and undefined (no typeof) will end up
  // basically breaking even. This seems to be as fast as it can go.
  function classToString(obj) {
    return internalToString.call(obj);
  }

  function hasOwn(obj, prop) {
    return !!obj && internalHasOwnProperty.call(obj, prop);
  }

  function getOwn(obj, prop) {
    if (hasOwn(obj, prop)) {
      return obj[prop];
    }
  }

  setupGlobal();

  

  // Flag allowing native methods to be enhanced.
  var ENHANCEMENTS_FLAG = 'enhance';

  // For type checking, etc. Excludes object as this is more nuanced.
  var NATIVE_TYPES = 'Boolean Number String Date RegExp Function Array Error Set Map';

  // Do strings have no keys?
  var NO_KEYS_IN_STRING_OBJECTS = !('0' in Object('a'));

  // Prefix for private properties.
  var PRIVATE_PROP_PREFIX = '_sugar_';

  // Matches 1..2 style ranges in properties.
  var PROPERTY_RANGE_REG = /^(.*?)\[([-\d]*)\.\.([-\d]*)\](.*)$/;

  // WhiteSpace/LineTerminator as defined in ES5.1 plus Unicode characters in the Space, Separator category.
  var TRIM_CHARS = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';

  // Regex for matching a formatted string.
  var STRING_FORMAT_REG = /([{}])\1|{([^}]*)}|(%)%|(%(\w*))/g;

  // Common chars
  var HALF_WIDTH_ZERO = 0x30,
      FULL_WIDTH_ZERO = 0xff10,
      HALF_WIDTH_PERIOD   = '.',
      FULL_WIDTH_PERIOD   = '．',
      HALF_WIDTH_COMMA    = ',',
      OPEN_BRACE  = '{',
      CLOSE_BRACE = '}';

  // Namespace aliases
  var sugarObject   = Sugar.Object,
      sugarArray    = Sugar.Array,
      sugarDate     = Sugar.Date,
      sugarString   = Sugar.String,
      sugarNumber   = Sugar.Number,
      sugarFunction = Sugar.Function,
      sugarRegExp   = Sugar.RegExp;

  // Class checks
  var isSerializable,
      isBoolean, isNumber, isString,
      isDate, isRegExp, isFunction,
      isArray, isSet, isMap, isError;

  function buildClassChecks() {

    var knownTypes = {};

    function addCoreTypes() {

      var names = spaceSplit(NATIVE_TYPES);

      isBoolean = buildPrimitiveClassCheck(names[0]);
      isNumber  = buildPrimitiveClassCheck(names[1]);
      isString  = buildPrimitiveClassCheck(names[2]);

      isDate   = buildClassCheck(names[3]);
      isRegExp = buildClassCheck(names[4]);

      // Wanted to enhance performance here by using simply "typeof"
      // but Firefox has two major issues that make this impossible,
      // one fixed, the other not, so perform a full class check here.
      //
      // 1. Regexes can be typeof "function" in FF < 3
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
      //
      // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
      isFunction = buildClassCheck(names[5]);

      // istanbul ignore next
      isArray = Array.isArray || buildClassCheck(names[6]);
      isError = buildClassCheck(names[7]);

      isSet = buildClassCheck(names[8], typeof Set !== 'undefined' && Set);
      isMap = buildClassCheck(names[9], typeof Map !== 'undefined' && Map);

      // Add core types as known so that they can be checked by value below,
      // notably excluding Functions and adding Arguments and Error.
      addKnownType('Arguments');
      addKnownType(names[0]);
      addKnownType(names[1]);
      addKnownType(names[2]);
      addKnownType(names[3]);
      addKnownType(names[4]);
      addKnownType(names[6]);

    }

    function addArrayTypes() {
      var types = 'Int8 Uint8 Uint8Clamped Int16 Uint16 Int32 Uint32 Float32 Float64';
      forEach(spaceSplit(types), function(str) {
        addKnownType(str + 'Array');
      });
    }

    function addKnownType(className) {
      var str = '[object '+ className +']';
      knownTypes[str] = true;
    }

    function isKnownType(className) {
      return knownTypes[className];
    }

    function buildClassCheck(className, globalObject) {
      // istanbul ignore if
      if (globalObject && isClass(new globalObject, 'Object')) {
        return getConstructorClassCheck(globalObject);
      } else {
        return getToStringClassCheck(className);
      }
    }

    // Map and Set may be [object Object] in certain IE environments.
    // In this case we need to perform a check using the constructor
    // instead of Object.prototype.toString.
    // istanbul ignore next
    function getConstructorClassCheck(obj) {
      var ctorStr = String(obj);
      return function(obj) {
        return String(obj.constructor) === ctorStr;
      };
    }

    function getToStringClassCheck(className) {
      return function(obj, str) {
        // perf: Returning up front on instanceof appears to be slower.
        return isClass(obj, className, str);
      };
    }

    function buildPrimitiveClassCheck(className) {
      var type = className.toLowerCase();
      return function(obj) {
        var t = typeof obj;
        return t === type || t === 'object' && isClass(obj, className);
      };
    }

    addCoreTypes();
    addArrayTypes();

    isSerializable = function(obj, className) {
      // Only known objects can be serialized. This notably excludes functions,
      // host objects, Symbols (which are matched by reference), and instances
      // of classes. The latter can arguably be matched by value, but
      // distinguishing between these and host objects -- which should never be
      // compared by value -- is very tricky so not dealing with it here.
      return isKnownType(className) || isPlainObject(obj, className);
    };

  }

  function isClass(obj, className, str) {
    if (!str) {
      str = classToString(obj);
    }
    return str === '[object '+ className +']';
  }

  // Wrapping the core's "define" methods to
  // save a few bytes in the minified script.
  function wrapNamespace(method) {
    return function(sugarNamespace, arg1, arg2) {
      sugarNamespace[method](arg1, arg2);
    };
  }

  // Method define aliases
  var alias                       = wrapNamespace('alias'),
      defineStatic                = wrapNamespace('defineStatic'),
      defineInstance              = wrapNamespace('defineInstance'),
      defineStaticPolyfill        = wrapNamespace('defineStaticPolyfill'),
      defineInstancePolyfill      = wrapNamespace('defineInstancePolyfill'),
      defineInstanceAndStatic     = wrapNamespace('defineInstanceAndStatic'),
      defineInstanceWithArguments = wrapNamespace('defineInstanceWithArguments');

  function defineInstanceSimilar(sugarNamespace, set, fn, flags) {
    defineInstance(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function defineInstanceAndStaticSimilar(sugarNamespace, set, fn, flags) {
    defineInstanceAndStatic(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function collectSimilarMethods(set, fn) {
    var methods = {};
    if (isString(set)) {
      set = spaceSplit(set);
    }
    forEach(set, function(el, i) {
      fn(methods, el, i);
    });
    return methods;
  }

  // This song and dance is to fix methods to a different length
  // from what they actually accept in order to stay in line with
  // spec. Additionally passing argument length, as some methods
  // throw assertion errors based on this (undefined check is not
  // enough). Fortunately for now spec is such that passing 3
  // actual arguments covers all requirements. Note that passing
  // the argument length also forces the compiler to not rewrite
  // length of the compiled function.
  function fixArgumentLength(fn) {
    var staticFn = function(a) {
      var args = arguments;
      return fn(a, args[1], args[2], args.length - 1);
    };
    staticFn.instance = function(b) {
      var args = arguments;
      return fn(this, b, args[1], args.length);
    };
    return staticFn;
  }

  function defineAccessor(namespace, name, fn) {
    setProperty(namespace, name, fn);
  }

  function defineOptionsAccessor(namespace, defaults) {
    var obj = simpleClone(defaults);

    function getOption(name) {
      return obj[name];
    }

    function setOption(arg1, arg2) {
      var options;
      if (arguments.length === 1) {
        options = arg1;
      } else {
        options = {};
        options[arg1] = arg2;
      }
      forEachProperty(options, function(val, name) {
        if (val === null) {
          val = defaults[name];
        }
        obj[name] = val;
      });
    }

    defineAccessor(namespace, 'getOption', getOption);
    defineAccessor(namespace, 'setOption', setOption);
    return getOption;
  }

  // For methods defined directly on the prototype like Range
  function defineOnPrototype(ctor, methods) {
    var proto = ctor.prototype;
    forEachProperty(methods, function(val, key) {
      proto[key] = val;
    });
  }

  // Argument helpers

  function assertArgument(exists) {
    if (!exists) {
      throw new TypeError('Argument required');
    }
  }

  function assertCallable(obj) {
    if (!isFunction(obj)) {
      throw new TypeError('Function is not callable');
    }
  }

  function assertArray(obj) {
    if (!isArray(obj)) {
      throw new TypeError('Array required');
    }
  }

  function assertWritable(obj) {
    if (isPrimitive(obj)) {
      // If strict mode is active then primitives will throw an
      // error when attempting to write properties. We can't be
      // sure if strict mode is available, so pre-emptively
      // throw an error here to ensure consistent behavior.
      throw new TypeError('Property cannot be written');
    }
  }

  // Coerces an object to a positive integer.
  // Does not allow Infinity.
  function coercePositiveInteger(n) {
    n = +n || 0;
    if (n < 0 || !isNumber(n) || !isFinite(n)) {
      throw new RangeError('Invalid number');
    }
    return trunc(n);
  }


  // General helpers

  function isDefined(o) {
    return o !== undefined;
  }

  function isUndefined(o) {
    return o === undefined;
  }

  function privatePropertyAccessor(key) {
    var privateKey = PRIVATE_PROP_PREFIX + key;
    return function(obj, val) {
      if (arguments.length > 1) {
        setProperty(obj, privateKey, val);
        return obj;
      }
      return obj[privateKey];
    };
  }

  function setChainableConstructor(sugarNamespace, createFn) {
    sugarNamespace.prototype.constructor = function() {
      return createFn.apply(this, arguments);
    };
  }

  // Fuzzy matching helpers

  function getMatcher(f) {
    if (!isPrimitive(f)) {
      var className = classToString(f);
      if (isRegExp(f, className)) {
        return regexMatcher(f);
      } else if (isDate(f, className)) {
        return dateMatcher(f);
      } else if (isFunction(f, className)) {
        return functionMatcher(f);
      } else if (isPlainObject(f, className)) {
        return fuzzyMatcher(f);
      }
    }
    // Default is standard isEqual
    return defaultMatcher(f);
  }

  function fuzzyMatcher(obj) {
    var matchers = {};
    return function(el, i, arr) {
      var matched = true;
      if (!isObjectType(el)) {
        return false;
      }
      forEachProperty(obj, function(val, key) {
        matchers[key] = getOwn(matchers, key) || getMatcher(val);
        if (matchers[key].call(arr, el[key], i, arr) === false) {
          matched = false;
        }
        return matched;
      });
      return matched;
    };
  }

  function defaultMatcher(f) {
    return function(el) {
      return isEqual(el, f);
    };
  }

  function regexMatcher(reg) {
    reg = RegExp(reg);
    return function(el) {
      return reg.test(el);
    };
  }

  function dateMatcher(d) {
    var ms = d.getTime();
    return function(el) {
      return !!(el && el.getTime) && el.getTime() === ms;
    };
  }

  function functionMatcher(fn) {
    return function(el, i, arr) {
      // Return true up front if match by reference
      return el === fn || fn.call(arr, el, i, arr);
    };
  }

  // Object helpers

  function getKeys(obj) {
    return Object.keys(obj);
  }

  function deepHasProperty(obj, key, any) {
    return handleDeepProperty(obj, key, any, true);
  }

  function deepGetProperty(obj, key, any) {
    return handleDeepProperty(obj, key, any, false);
  }

  function deepSetProperty(obj, key, val) {
    handleDeepProperty(obj, key, false, false, true, false, val);
    return obj;
  }

  function handleDeepProperty(obj, key, any, has, fill, fillLast, val) {
    var ns, bs, ps, cbi, set, isLast, isPush, isIndex, nextIsIndex, exists;
    ns = obj;
    if (key == null) return;

    if (isObjectType(key)) {
      // Allow array and array-like accessors
      bs = [key];
    } else {
      key = String(key);
      if (key.indexOf('..') !== -1) {
        return handleArrayIndexRange(obj, key, any, val);
      }
      bs = key.split('[');
    }

    set = isDefined(val);

    for (var i = 0, blen = bs.length; i < blen; i++) {
      ps = bs[i];

      if (isString(ps)) {
        ps = periodSplit(ps);
      }

      for (var j = 0, plen = ps.length; j < plen; j++) {
        key = ps[j];

        // Is this the last key?
        isLast = i === blen - 1 && j === plen - 1;

        // Index of the closing ]
        cbi = key.indexOf(']');

        // Is the key an array index?
        isIndex = cbi !== -1;

        // Is this array push syntax "[]"?
        isPush = set && cbi === 0;

        // If the bracket split was successful and this is the last element
        // in the dot split, then we know the next key will be an array index.
        nextIsIndex = blen > 1 && j === plen - 1;

        if (isPush) {
          // Set the index to the end of the array
          key = ns.length;
        } else if (isIndex) {
          // Remove the closing ]
          key = key.slice(0, -1);
        }

        // If the array index is less than 0, then
        // add its length to allow negative indexes.
        if (isIndex && key < 0) {
          key = +key + ns.length;
        }

        // Bracket keys may look like users[5] or just [5], so the leading
        // characters are optional. We can enter the namespace if this is the
        // 2nd part, if there is only 1 part, or if there is an explicit key.
        if (i || key || blen === 1) {

          // TODO: need to be sure this check handles ''.length when
          // we refactor.
          exists = any ? key in Object(ns) : hasOwn(ns, key);

          // Non-existent namespaces are only filled if they are intermediate
          // (not at the end) or explicitly filling the last.
          if (fill && (!isLast || fillLast) && !exists) {
            // For our purposes, last only needs to be an array.
            ns = ns[key] = nextIsIndex || (fillLast && isLast) ? [] : {};
            continue;
          }

          if (has) {
            if (isLast || !exists) {
              return exists;
            }
          } else if (set && isLast) {
            assertWritable(ns);
            ns[key] = val;
          }

          ns = exists ? ns[key] : undefined;
        }

      }
    }
    return ns;
  }

  // Get object property with support for 0..1 style range notation.
  function handleArrayIndexRange(obj, key, any, val) {
    var match, start, end, leading, trailing, arr, set;
    match = key.match(PROPERTY_RANGE_REG);
    if (!match) {
      return;
    }

    set = isDefined(val);
    leading = match[1];

    if (leading) {
      arr = handleDeepProperty(obj, leading, any, false, set ? true : false, true);
    } else {
      arr = obj;
    }

    assertArray(arr);

    trailing = match[4];
    start    = match[2] ? +match[2] : 0;
    end      = match[3] ? +match[3] : arr.length;

    // A range of 0..1 is inclusive, so we need to add 1 to the end. If this
    // pushes the index from -1 to 0, then set it to the full length of the
    // array, otherwise it will return nothing.
    end = end === -1 ? arr.length : end + 1;

    if (set) {
      for (var i = start; i < end; i++) {
        handleDeepProperty(arr, i + trailing, any, false, true, false, val);
      }
    } else {
      arr = arr.slice(start, end);

      // If there are trailing properties, then they need to be mapped for each
      // element in the array.
      if (trailing) {
        if (trailing.charAt(0) === HALF_WIDTH_PERIOD) {
          // Need to chomp the period if one is trailing after the range. We
          // can't do this at the regex level because it will be required if
          // we're setting the value as it needs to be concatentated together
          // with the array index to be set.
          trailing = trailing.slice(1);
        }
        return arr.map(function(el) {
          return handleDeepProperty(el, trailing);
        });
      }
    }
    return arr;
  }

  function getOwnKey(obj, key) {
    if (hasOwn(obj, key)) {
      return key;
    }
  }

  function hasProperty(obj, prop) {
    return !isPrimitive(obj) && prop in obj;
  }

  function isObjectType(obj, type) {
    return !!obj && (type || typeof obj) === 'object';
  }

  function isPrimitive(obj, type) {
    type = type || typeof obj;
    return obj == null || type === 'string' || type === 'number' || type === 'boolean';
  }

  function isPlainObject(obj, className) {
    return isObjectType(obj) &&
           isClass(obj, 'Object', className) &&
           hasValidPlainObjectPrototype(obj) &&
           hasOwnEnumeratedProperties(obj);
  }

  function hasValidPlainObjectPrototype(obj) {
    var hasToString = 'toString' in obj;
    var hasConstructor = 'constructor' in obj;
    // An object created with Object.create(null) has no methods in the
    // prototype chain, so check if any are missing. The additional hasToString
    // check is for false positives on some host objects in old IE which have
    // toString but no constructor. If the object has an inherited constructor,
    // then check if it is Object (the "isPrototypeOf" tapdance here is a more
    // robust way of ensuring this if the global has been hijacked). Note that
    // accessing the constructor directly (without "in" or "hasOwnProperty")
    // will throw a permissions error in IE8 on cross-domain windows.
    return (!hasConstructor && !hasToString) ||
            (hasConstructor && !hasOwn(obj, 'constructor') &&
             hasOwn(obj.constructor.prototype, 'isPrototypeOf'));
  }

  function hasOwnEnumeratedProperties(obj) {
    // Plain objects are generally defined as having enumerated properties
    // all their own, however in early IE environments without defineProperty,
    // there may also be enumerated methods in the prototype chain, so check
    // for both of these cases.
    var objectProto = Object.prototype;
    for (var key in obj) {
      var val = obj[key];
      if (!hasOwn(obj, key) && val !== objectProto[key]) {
        return false;
      }
    }
    return true;
  }

  function simpleRepeat(n, fn) {
    for (var i = 0; i < n; i++) {
      fn(i);
    }
  }

  function simpleClone(obj) {
    return simpleMerge({}, obj);
  }

  // TODO: Use Object.assign here going forward.
  function simpleMerge(target, source) {
    forEachProperty(source, function(val, key) {
      target[key] = val;
    });
    return target;
  }

  // Make primtives types like strings into objects.
  function coercePrimitiveToObject(obj) {
    if (isPrimitive(obj)) {
      obj = Object(obj);
    }
    // istanbul ignore next
    if (NO_KEYS_IN_STRING_OBJECTS && isString(obj)) {
      forceStringCoercion(obj);
    }
    return obj;
  }

  // Force strings to have their indexes set in
  // environments that don't do this automatically.
  // istanbul ignore next
  function forceStringCoercion(obj) {
    var i = 0, chr;
    while (chr = obj.charAt(i)) {
      obj[i++] = chr;
    }
  }

  // Equality helpers

  // Perf
  function isEqual(a, b, stack) {
    var aClass, bClass;
    if (a === b) {
      // Return quickly up front when matched by reference,
      // but be careful about 0 !== -0.
      return a !== 0 || 1 / a === 1 / b;
    }
    aClass = classToString(a);
    bClass = classToString(b);
    if (aClass !== bClass) {
      return false;
    }

    if (isSerializable(a, aClass) && isSerializable(b, bClass)) {
      return objectIsEqual(a, b, aClass, stack);
    } else if (isSet(a, aClass) && isSet(b, bClass)) {
      return a.size === b.size && isEqual(setToArray(a), setToArray(b), stack);
    } else if (isMap(a, aClass) && isMap(b, bClass)) {
      return a.size === b.size && isEqual(mapToArray(a), mapToArray(b), stack);
    } else if (isError(a, aClass) && isError(b, bClass)) {
      return a.toString() === b.toString();
    }

    return false;
  }

  // Perf
  function objectIsEqual(a, b, aClass, stack) {
    var aType = typeof a, bType = typeof b, propsEqual, count;
    if (aType !== bType) {
      return false;
    }
    if (isObjectType(a.valueOf())) {
      if (a.length !== b.length) {
        // perf: Quickly returning up front for arrays.
        return false;
      }
      count = 0;
      propsEqual = true;
      iterateWithCyclicCheck(a, false, stack, function(key, val, cyc, stack) {
        if (!cyc && (!(key in b) || !isEqual(val, b[key], stack))) {
          propsEqual = false;
        }
        count++;
        return propsEqual;
      });
      if (!propsEqual || count !== getKeys(b).length) {
        return false;
      }
    }
    // Stringifying the value handles NaN, wrapped primitives, dates, and errors in one go.
    return a.valueOf().toString() === b.valueOf().toString();
  }

  // Serializes an object in a way that will provide a token unique
  // to the type, class, and value of an object. Host objects, class
  // instances etc, are not serializable, and are held in an array
  // of references that will return the index as a unique identifier
  // for the object. This array is passed from outside so that the
  // calling function can decide when to dispose of this array.
  function serializeInternal(obj, refs, stack) {
    var type = typeof obj, sign = '', className, value, ref;

    // Return up front on
    if (1 / obj === -Infinity) {
      sign = '-';
    }

    // Return quickly for primitives to save cycles
    if (isPrimitive(obj, type) && !isRealNaN(obj)) {
      return type + sign + obj;
    }

    className = classToString(obj);

    if (!isSerializable(obj, className)) {
      ref = indexOf(refs, obj);
      if (ref === -1) {
        ref = refs.length;
        refs.push(obj);
      }
      return ref;
    } else if (isObjectType(obj)) {
      value = serializeDeep(obj, refs, stack) + obj.toString();
    } else if (obj.valueOf) {
      value = obj.valueOf();
    }
    return type + className + sign + value;
  }

  function serializeDeep(obj, refs, stack) {
    var result = '';
    iterateWithCyclicCheck(obj, true, stack, function(key, val, cyc, stack) {
      result += cyc ? 'CYC' : key + serializeInternal(val, refs, stack);
    });
    return result;
  }

  function iterateWithCyclicCheck(obj, sortedKeys, stack, fn) {

    function next(val, key) {
      var cyc = false;

      // Allowing a step into the structure before triggering this check to save
      // cycles on standard JSON structures and also to try as hard as possible to
      // catch basic properties that may have been modified.
      if (stack.length > 1) {
        var i = stack.length;
        while (i--) {
          if (stack[i] === val) {
            cyc = true;
          }
        }
      }

      stack.push(val);
      fn(key, val, cyc, stack);
      stack.pop();
    }

    function iterateWithSortedKeys() {
      // Sorted keys is required for serialization, where object order
      // does not matter but stringified order does.
      var arr = getKeys(obj).sort(), key;
      for (var i = 0; i < arr.length; i++) {
        key = arr[i];
        next(obj[key], arr[i]);
      }
    }

    // This method for checking for cyclic structures was egregiously stolen from
    // the ingenious method by @kitcambridge from the Underscore script:
    // https://github.com/documentcloud/underscore/issues/240
    if (!stack) {
      stack = [];
    }

    if (sortedKeys) {
      iterateWithSortedKeys();
    } else {
      forEachProperty(obj, next);
    }
  }


  // Array helpers

  function isArrayIndex(n) {
    return n >>> 0 == n && n != 0xFFFFFFFF;
  }

  function iterateOverSparseArray(arr, fn, fromIndex, loop) {
    var indexes = getSparseArrayIndexes(arr, fromIndex, loop), index;
    for (var i = 0, len = indexes.length; i < len; i++) {
      index = indexes[i];
      fn.call(arr, arr[index], index, arr);
    }
    return arr;
  }

  // It's unclear whether or not sparse arrays qualify as "simple enumerables".
  // If they are not, however, the wrapping function will be deoptimized, so
  // isolate here (also to share between es5 and array modules).
  function getSparseArrayIndexes(arr, fromIndex, loop, fromRight) {
    var indexes = [], i;
    for (i in arr) {
      // istanbul ignore next
      if (isArrayIndex(i) && (loop || (fromRight ? i <= fromIndex : i >= fromIndex))) {
        indexes.push(+i);
      }
    }
    indexes.sort(function(a, b) {
      var aLoop = a > fromIndex;
      var bLoop = b > fromIndex;
      // This block cannot be reached unless ES5 methods are being shimmed.
      // istanbul ignore if
      if (aLoop !== bLoop) {
        return aLoop ? -1 : 1;
      }
      return a - b;
    });
    return indexes;
  }

  function getEntriesForIndexes(obj, find, loop, isString) {
    var result, length = obj.length;
    if (!isArray(find)) {
      return entryAtIndex(obj, find, length, loop, isString);
    }
    result = new Array(find.length);
    forEach(find, function(index, i) {
      result[i] = entryAtIndex(obj, index, length, loop, isString);
    });
    return result;
  }

  function getNormalizedIndex(index, length, loop) {
    if (index && loop) {
      index = index % length;
    }
    if (index < 0) index = length + index;
    return index;
  }

  function entryAtIndex(obj, index, length, loop, isString) {
    index = getNormalizedIndex(index, length, loop);
    return isString ? obj.charAt(index) : obj[index];
  }

  function mapWithShortcuts(el, f, context, mapArgs) {
    if (!f) {
      return el;
    } else if (f.apply) {
      return f.apply(context, mapArgs);
    } else if (isArray(f)) {
      return f.map(function(m) {
        return mapWithShortcuts(el, m, context, mapArgs);
      });
    } else if (isFunction(el[f])) {
      return el[f].call(el);
    } else {
      return deepGetProperty(el, f, true);
    }
  }

  function spaceSplit(str) {
    return str.split(' ');
  }

  function commaSplit(str) {
    return str.split(HALF_WIDTH_COMMA);
  }

  function periodSplit(str) {
    return str.split(HALF_WIDTH_PERIOD);
  }

  function forEach(arr, fn) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (!(i in arr)) {
        return iterateOverSparseArray(arr, fn, i);
      }
      fn(arr[i], i);
    }
  }

  function filter(arr, fn) {
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      var el = arr[i];
      if (i in arr && fn(el, i)) {
        result.push(el);
      }
    }
    return result;
  }

  function map(arr, fn) {
    // perf: Not using fixed array len here as it may be sparse.
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr) {
        result.push(fn(arr[i], i));
      }
    }
    return result;
  }

  function indexOf(arr, el) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr && arr[i] === el) return i;
    }
    return -1;
  }

  // Number helpers

  // istanbul ignore next
  var trunc = Math.trunc || function(n) {
    if (n === 0 || !isFinite(n)) return n;
    return n < 0 ? ceil(n) : floor(n);
  };

  function isRealNaN(obj) {
    // This is only true of NaN
    return obj != null && obj !== obj;
  }

  function withPrecision(val, precision, fn) {
    var multiplier = pow(10, abs(precision || 0));
    fn = fn || round;
    if (precision < 0) multiplier = 1 / multiplier;
    return fn(val * multiplier) / multiplier;
  }

  function padNumber(num, place, sign, base, replacement) {
    var str = abs(num).toString(base || 10);
    str = repeatString(replacement || '0', place - str.replace(/\.\d+/, '').length) + str;
    if (sign || num < 0) {
      str = (num < 0 ? '-' : '+') + str;
    }
    return str;
  }

  function getOrdinalSuffix(num) {
    if (num >= 11 && num <= 13) {
      return 'th';
    } else {
      switch(num % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
      }
    }
  }

  // Fullwidth number helpers
  var fullWidthNumberReg, fullWidthNumberMap, fullWidthNumbers;

  function buildFullWidthNumber() {
    var fwp = FULL_WIDTH_PERIOD, hwp = HALF_WIDTH_PERIOD, hwc = HALF_WIDTH_COMMA, fwn = '';
    fullWidthNumberMap = {};
    for (var i = 0, digit; i <= 9; i++) {
      digit = chr(i + FULL_WIDTH_ZERO);
      fwn += digit;
      fullWidthNumberMap[digit] = chr(i + HALF_WIDTH_ZERO);
    }
    fullWidthNumberMap[hwc] = '';
    fullWidthNumberMap[fwp] = hwp;
    // Mapping this to itself to capture it easily
    // in stringToNumber to detect decimals later.
    fullWidthNumberMap[hwp] = hwp;
    fullWidthNumberReg = allCharsReg(fwn + fwp + hwc + hwp);
    fullWidthNumbers = fwn;
  }

  // Takes into account full-width characters, commas, and decimals.
  function stringToNumber(str, base) {
    var sanitized, isDecimal;
    sanitized = str.replace(fullWidthNumberReg, function(chr) {
      var replacement = getOwn(fullWidthNumberMap, chr);
      if (replacement === HALF_WIDTH_PERIOD) {
        isDecimal = true;
      }
      return replacement;
    });
    return isDecimal ? parseFloat(sanitized) : parseInt(sanitized, base || 10);
  }

  // Math aliases
  var abs   = Math.abs,
      pow   = Math.pow,
      min   = Math.min,
      max   = Math.max,
      ceil  = Math.ceil,
      floor = Math.floor,
      round = Math.round;


  // String helpers

  var chr = String.fromCharCode;

  function trim(str) {
    return str.trim();
  }

  function repeatString(str, num) {
    var result = '';
    str = str.toString();
    while (num > 0) {
      if (num & 1) {
        result += str;
      }
      if (num >>= 1) {
        str += str;
      }
    }
    return result;
  }

  function simpleCapitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function createFormatMatcher(bracketMatcher, percentMatcher, precheck) {

    var reg = STRING_FORMAT_REG;
    var compileMemoized = memoizeFunction(compile);

    function getToken(format, match) {
      var get, token, literal, fn;
      var bKey = match[2];
      var pLit = match[3];
      var pKey = match[5];
      if (match[4] && percentMatcher) {
        token = pKey;
        get = percentMatcher;
      } else if (bKey) {
        token = bKey;
        get = bracketMatcher;
      } else if (pLit && percentMatcher) {
        literal = pLit;
      } else {
        literal = match[1] || match[0];
      }
      if (get) {
        assertPassesPrecheck(precheck, bKey, pKey);
        fn = function(obj, opt) {
          return get(obj, token, opt);
        };
      }
      format.push(fn || getLiteral(literal));
    }

    function getSubstring(format, str, start, end) {
      if (end > start) {
        var sub = str.slice(start, end);
        assertNoUnmatched(sub, OPEN_BRACE);
        assertNoUnmatched(sub, CLOSE_BRACE);
        format.push(function() {
          return sub;
        });
      }
    }

    function getLiteral(str) {
      return function() {
        return str;
      };
    }

    function assertPassesPrecheck(precheck, bt, pt) {
      if (precheck && !precheck(bt, pt)) {
        throw new TypeError('Invalid token '+ (bt || pt) +' in format string');
      }
    }

    function assertNoUnmatched(str, chr) {
      if (str.indexOf(chr) !== -1) {
        throw new TypeError('Unmatched '+ chr +' in format string');
      }
    }

    function compile(str) {
      var format = [], lastIndex = 0, match;
      reg.lastIndex = 0;
      while(match = reg.exec(str)) {
        getSubstring(format, str, lastIndex, match.index);
        getToken(format, match);
        lastIndex = reg.lastIndex;
      }
      getSubstring(format, str, lastIndex, str.length);
      return format;
    }

    return function(str, obj, opt) {
      var format = compileMemoized(str), result = '';
      for (var i = 0; i < format.length; i++) {
        result += format[i](obj, opt);
      }
      return result;
    };
  }

  // Inflection helper

  var Inflections = {};

  function getAcronym(str) {
    // istanbul ignore next
    return Inflections.acronyms && Inflections.acronyms.find(str);
  }

  function getHumanWord(str) {
    // istanbul ignore next
    return Inflections.human && Inflections.human.find(str);
  }

  function runHumanRules(str) {
    // istanbul ignore next
    return Inflections.human && Inflections.human.runRules(str) || str;
  }

  // RegExp helpers

  function allCharsReg(src) {
    return RegExp('[' + src + ']', 'g');
  }

  function getRegExpFlags(reg, add) {
    var flags = '';
    add = add || '';
    function checkFlag(prop, flag) {
      if (prop || add.indexOf(flag) > -1) {
        flags += flag;
      }
    }
    checkFlag(reg.global, 'g');
    checkFlag(reg.ignoreCase, 'i');
    checkFlag(reg.multiline, 'm');
    checkFlag(reg.sticky, 'y');
    return flags;
  }

  function escapeRegExp(str) {
    if (!isString(str)) str = String(str);
    return str.replace(/([\\/'*+?|()[\]{}.^$-])/g,'\\$1');
  }

  // Date helpers

  var _utc = privatePropertyAccessor('utc');

  function callDateGet(d, method) {
    return d['get' + (_utc(d) ? 'UTC' : '') + method]();
  }

  function callDateSet(d, method, value, safe) {
    // "Safe" denotes not setting the date if the value is the same as what is
    // currently set. In theory this should be a noop, however it will cause
    // timezone shifts when in the middle of a DST fallback. This is unavoidable
    // as the notation itself is ambiguous (i.e. there are two "1:00ams" on
    // November 1st, 2015 in northern hemisphere timezones that follow DST),
    // however when advancing or rewinding dates this can throw off calculations
    // so avoiding this unintentional shifting on an opt-in basis.
    if (safe && value === callDateGet(d, method, value)) {
      return;
    }
    d['set' + (_utc(d) ? 'UTC' : '') + method](value);
  }

  // Memoization helpers

  var INTERNAL_MEMOIZE_LIMIT = 1000;

  // Note that attemps to consolidate this with Function#memoize
  // ended up clunky as that is also serializing arguments. Separating
  // these implementations turned out to be simpler.
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

  // ES6 helpers

  function setToArray(set) {
    var arr = new Array(set.size), i = 0;
    set.forEach(function(val) {
      arr[i++] = val;
    });
    return arr;
  }

  function mapToArray(map) {
    var arr = new Array(map.size), i = 0;
    map.forEach(function(val, key) {
      arr[i++] = [key, val];
    });
    return arr;
  }

  buildClassChecks();
  buildFullWidthNumber();

  

  // Non-enumerable properties on Object.prototype. In early JScript implementations
  // (< IE9) these will shadow object properties and break for..in loops.
  var DONT_ENUM_PROPS = [
    'valueOf',
    'toString',
    'constructor',
    'isPrototypeOf',
    'hasOwnProperty',
    'toLocaleString',
    'propertyIsEnumerable'
  ];

  
  function buildDontEnumFix() {
    if (!({toString:1}).propertyIsEnumerable('toString')) {
      var forEachEnumerableProperty = forEachProperty;
      forEachProperty = function(obj, fn) {
        forEachEnumerableProperty(obj, fn);
        for (var i = 0, key; key = DONT_ENUM_PROPS[i]; i++) {
          if (hasOwn(obj, key)) {
            if(fn.call(obj, obj[key], key, obj) === false) break;
          }
        }
      };
    }
  }

  
  function buildChainableNativeMethodsFix() {
    if (!Object.getOwnPropertyNames) {
      defineNativeMethodsOnChainable();
    }
  }

  // Polyfilled methods will automatically be added to the chainable prototype.
  // However, Object.getOwnPropertyNames cannot be shimmed for non-enumerable
  // properties, so if it does not exist, then the only way to access native
  // methods previous to ES5 is to provide them as a list of tokens here.
  function defineNativeMethodsOnChainable() {

    var nativeTokens = {
      'Function': 'apply,call',
      'RegExp':   'compile,exec,test',
      'Number':   'toExponential,toFixed,toLocaleString,toPrecision',
      'Object':   'hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString',
      'Array':    'concat,join,pop,push,reverse,shift,slice,sort,splice,toLocaleString,unshift',
      'Date':     'getTime,getTimezoneOffset,setTime,toDateString,toGMTString,toLocaleDateString,toLocaleString,toLocaleTimeString,toTimeString,toUTCString',
      'String':   'anchor,big,blink,bold,charAt,charCodeAt,concat,fixed,fontcolor,fontsize,indexOf,italics,lastIndexOf,link,localeCompare,match,replace,search,slice,small,split,strike,sub,substr,substring,sup,toLocaleLowerCase,toLocaleUpperCase,toLowerCase,toUpperCase'
    };

    var dateTokens = 'FullYear,Month,Date,Hours,Minutes,Seconds,Milliseconds'.split(',');

    function addDateTokens(prefix, arr) {
      for (var i = 0; i < dateTokens.length; i++) {
        arr.push(prefix + dateTokens[i]);
      }
    }

    forEachProperty(nativeTokens, function(str, name) {
      var tokens = str.split(',');
      if (name === 'Date') {
        addDateTokens('get', tokens);
        addDateTokens('set', tokens);
        addDateTokens('getUTC', tokens);
        addDateTokens('setUTC', tokens);
      }
      tokens.push('toString');
      mapNativeToChainable(name, tokens);
    });

  }


  buildDontEnumFix();
  buildChainableNativeMethodsFix();


  

  function assertNonNull(obj) {
    if (obj == null) {
      throw new TypeError('Object required');
    }
  }

  defineStaticPolyfill(sugarObject, {

    'keys': function(obj) {
      var keys = [];
      assertNonNull(obj);
      forEachProperty(coercePrimitiveToObject(obj), function(val, key) {
        keys.push(key);
      });
      return keys;
    }

  });


  

  function arrayIndexOf(arr, search, fromIndex, fromRight) {
    var length = arr.length, defaultFromIndex, index, increment;

    increment = fromRight ? -1 : 1;
    defaultFromIndex = fromRight ? length - 1 : 0;
    fromIndex = trunc(fromIndex);
    if (!fromIndex && fromIndex !== 0) {
      fromIndex = defaultFromIndex;
    }
    if (fromIndex < 0) {
      fromIndex = length + fromIndex;
    }
    if ((!fromRight && fromIndex < 0) || (fromRight && fromIndex >= length)) {
      fromIndex = defaultFromIndex;
    }

    index = fromIndex;

    while((fromRight && index >= 0) || (!fromRight && index < length)) {
      if (!(index in arr)) {
        return sparseIndexOf(arr, search, fromIndex, fromRight);
      }
      if (isArrayIndex(index) && arr[index] === search) {
        return index;
      }
      index += increment;
    }
    return -1;
  }

  function sparseIndexOf(arr, search, fromIndex, fromRight) {
    var indexes = getSparseArrayIndexes(arr, fromIndex, false, fromRight), index;
    indexes.sort(function(a, b) {
      return fromRight ? b - a : a - b;
    });
    while ((index = indexes.shift()) !== undefined) {
      if (arr[index] === search) {
        return +index;
      }
    }
    return -1;
  }

  function arrayReduce(arr, fn, initialValue, fromRight) {
    var length = arr.length, count = 0, defined = isDefined(initialValue), result, index;
    assertCallable(fn);
    if (length == 0 && !defined) {
      throw new TypeError('Reduce called on empty array with no initial value');
    } else if (defined) {
      result = initialValue;
    } else {
      result = arr[fromRight ? length - 1 : count];
      count++;
    }
    while(count < length) {
      index = fromRight ? length - count - 1 : count;
      if (index in arr) {
        result = fn(result, arr[index], index, arr);
      }
      count++;
    }
    return result;
  }

  defineStaticPolyfill(sugarArray, {

    
    'isArray': function(obj) {
      return isArray(obj);
    }

  });

  defineInstancePolyfill(sugarArray, {

    'every': function(fn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      var length = this.length, index = 0;
      assertCallable(fn);
      while(index < length) {
        if (index in this && !fn.call(context, this[index], index, this)) {
          return false;
        }
        index++;
      }
      return true;
    },

    'some': function(fn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      var length = this.length, index = 0;
      assertCallable(fn);
      while(index < length) {
        if (index in this && fn.call(context, this[index], index, this)) {
          return true;
        }
        index++;
      }
      return false;
    },

    'map': function(fn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      var length = this.length, index = 0, result = new Array(length);
      assertCallable(fn);
      while(index < length) {
        if (index in this) {
          result[index] = fn.call(context, this[index], index, this);
        }
        index++;
      }
      return result;
    },

    'filter': function(fn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      var length = this.length, index = 0, result = [];
      assertCallable(fn);
      while(index < length) {
        if (index in this && fn.call(context, this[index], index, this)) {
          result.push(this[index]);
        }
        index++;
      }
      return result;
    },

    
    'indexOf': function(search) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, fromIndex = arguments[1];
      if (isString(this)) return this.indexOf(search, fromIndex);
      return arrayIndexOf(this, search, fromIndex);
    },

    
    'lastIndexOf': function(search) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, fromIndex = arguments[1];
      if (isString(this)) return this.lastIndexOf(search, fromIndex);
      return arrayIndexOf(this, search, fromIndex, true);
    },

    
    'forEach': function(eachFn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      var length = this.length, index = 0;
      assertCallable(eachFn);
      while(index < length) {
        if (index in this) {
          eachFn.call(context, this[index], index, this);
        }
        index++;
      }
    },

    
    'reduce': function(reduceFn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      return arrayReduce(this, reduceFn, context);
    },

    
    'reduceRight': function(reduceFn) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      return arrayReduce(this, reduceFn, context, true);
    }

  });


  

  var TRIM_REG = RegExp('^[' + TRIM_CHARS + ']+|['+ TRIM_CHARS +']+$', 'g');

  defineInstancePolyfill(sugarString, {
    
    'trim': function() {
      return this.toString().replace(TRIM_REG, '');
    }
  });


  

  defineInstancePolyfill(sugarFunction, {

     
    'bind': function(context) {
      // Optimized: no leaking arguments
      var boundArgs = []; for(var $i = 1, $len = arguments.length; $i < $len; $i++) boundArgs.push(arguments[$i]);
      var fn = this, bound;
      assertCallable(this);
      bound = function() {
        // Optimized: no leaking arguments
        var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
        return fn.apply(fn.prototype && this instanceof fn ? this : context, boundArgs.concat(args));
      };
      bound.prototype = this.prototype;
      return bound;
    }

  });


  

  defineStaticPolyfill(sugarDate, {

     
    'now': function() {
      return new Date().getTime();
    }

  });

  function hasISOSupport() {
    var d = new Date(Date.UTC(2000, 0));
    return !!d.toISOString && d.toISOString() === '2000-01-01T00:00:00.000Z';
  }

  defineInstancePolyfill(sugarDate, {

     
    'toISOString': function() {
      return padNumber(this.getUTCFullYear(), 4) + '-' +
             padNumber(this.getUTCMonth() + 1, 2) + '-' +
             padNumber(this.getUTCDate(), 2) + 'T' +
             padNumber(this.getUTCHours(), 2) + ':' +
             padNumber(this.getUTCMinutes(), 2) + ':' +
             padNumber(this.getUTCSeconds(), 2) + '.' +
             padNumber(this.getUTCMilliseconds(), 3) + 'Z';
    },

     
    'toJSON': function(key) {
      // Force compiler to respect argument length.
      var argLen = arguments.length;
      return this.toISOString(key);
    }

  }, !hasISOSupport());

  


  

  function getCoercedStringSubject(obj) {
    if (obj == null) {
      throw new TypeError('String required.');
    }
    return String(obj);
  }

  function getCoercedSearchString(obj) {
    if (isRegExp(obj)) {
      throw new TypeError();
    }
    return String(obj);
  }

  defineInstancePolyfill(sugarString, {

    
    'includes': function(searchString) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, pos = arguments[1];
      var str = getCoercedStringSubject(this);
      searchString = getCoercedSearchString(searchString);
      return str.indexOf(searchString, pos) !== -1;
    },

    
    'startsWith': function(searchString) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, position = arguments[1];
      var str, start, pos, len, searchLength;
      str = getCoercedStringSubject(this);
      searchString = getCoercedSearchString(searchString);
      pos = +position || 0;
      len = str.length;
      start = min(max(pos, 0), len);
      searchLength = searchString.length;
      if (searchLength + start > len) {
        return false;
      }
      if (str.substr(start, searchLength) === searchString) {
        return true;
      }
      return false;
    },

    
    'endsWith': function(searchString) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, endPosition = arguments[1];
      var str, start, end, pos, len, searchLength;
      str = getCoercedStringSubject(this);
      searchString = getCoercedSearchString(searchString);
      len = str.length;
      pos = len;
      if (isDefined(endPosition)) {
        pos = +endPosition || 0;
      }
      end = min(max(pos, 0), len);
      searchLength = searchString.length;
      start = end - searchLength;
      if (start < 0) {
        return false;
      }
      if (str.substr(start, searchLength) === searchString) {
        return true;
      }
      return false;
    },

    
    'repeat': function(num) {
      num = coercePositiveInteger(num);
      return repeatString(this, num);
    }

  });


  

  // istanbul ignore next
  defineStaticPolyfill(sugarNumber, {

    
    'isNaN': function(obj) {
      return isRealNaN(obj);
    }

  });


  

  function getCoercedObject(obj) {
    if (obj == null) {
      throw new TypeError('Object required.');
    }
    return coercePrimitiveToObject(obj);
  }

  defineStaticPolyfill(sugarArray, {

    
    'from': function(a) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, mapFn = arguments[1], context = arguments[2];
      var len, arr;
      if (isDefined(mapFn)) {
        assertCallable(mapFn);
      }
      a = getCoercedObject(a);
      len = trunc(max(0, a.length || 0));
      if (!isArrayIndex(len)) {
        throw new RangeError('Invalid array length');
      }
      if (isFunction(this)) {
        arr = new this(len);
        arr.length = len;
      } else {
        arr = new Array(len);
      }
      for (var i = 0; i < len; i++) {
        setProperty(arr, i, isDefined(mapFn) ? mapFn.call(context, a[i], i) : a[i], true);
      }
      return arr;
    }

  });

  defineInstancePolyfill(sugarArray, {

    'find': function(f) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      assertCallable(f);
      for (var i = 0, len = this.length; i < len; i++) {
        if (f.call(context, this[i], i, this)) {
          return this[i];
        }
      }
    },

    'findIndex': function(f) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      assertCallable(f);
      for (var i = 0, len = this.length; i < len; i++) {
        if (f.call(context, this[i], i, this)) {
          return i;
        }
      }
      return -1;
    }

  });

  


  

  function sameValueZero(a, b) {
    if (isRealNaN(a)) {
      return isRealNaN(b);
    }
    return a === b ? a !== 0 || 1 / a === 1 / b : false;
  }

  defineInstancePolyfill(sugarArray, {

    
    'includes': function(search) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, fromIndex = arguments[1];
      var arr = this, len;
      if (isString(arr)) {
        return arr.includes(search, fromIndex);
      }
      fromIndex = fromIndex ? fromIndex.valueOf() : 0;
      len = arr.length;
      if (fromIndex < 0) {
        fromIndex = max(0, fromIndex + len);
      }
      for (var i = fromIndex; i < len; i++) {
        if (sameValueZero(search, arr[i])) {
          return true;
        }
      }
      return false;
    }

  });

  

  // Flag allowing native string methods to be enhanced.
  var STRING_ENHANCEMENTS_FLAG = 'enhanceString';

  // Matches non-punctuation characters except apostrophe for capitalization.
  var CAPITALIZE_REG = /[^\u0000-\u0040\u005B-\u0060\u007B-\u007F]+('s)?/g;

  // Regex matching camelCase.
  var CAMELIZE_REG = /(^|_)([^_]+)/g;

  // Regex matching any HTML entity.
  var HTML_ENTITY_REG = /&#?(x)?([\w\d]{0,5});/gi;

  // Very basic HTML escaping regex.
  var HTML_ESCAPE_REG = /[&<>]/g;

  // Special HTML entities.
  var HTMLFromEntityMap = {
    'lt':    '<',
    'gt':    '>',
    'amp':   '&',
    'nbsp':  ' ',
    'quot':  '"',
    'apos':  "'"
  };

  var HTMLToEntityMap;

  // Words that should not be capitalized in titles
  var DOWNCASED_WORDS = [
    'and', 'or', 'nor', 'a', 'an', 'the', 'so', 'but', 'to', 'of', 'at',
    'by', 'from', 'into', 'on', 'onto', 'off', 'out', 'in', 'over',
    'with', 'for'
  ];

  // HTML tags that do not have inner content.
  var HTML_VOID_ELEMENTS = [
    'area','base','br','col','command','embed','hr','img',
    'input','keygen','link','meta','param','source','track','wbr'
  ];

  var LEFT_TRIM_REG  = RegExp('^['+ TRIM_CHARS +']+');
  var RIGHT_TRIM_REG = RegExp('['+ TRIM_CHARS +']+$');
  var TRUNC_REG      = RegExp('(?=[' + TRIM_CHARS + '])');

  // Reference to native String#includes to enhance later.
  var nativeIncludes = String.prototype.includes;

  // Base64
  var encodeBase64, decodeBase64;

  // Format matcher for String#format.
  var stringFormatMatcher = createFormatMatcher(deepGetProperty);

  function padString(num, padding) {
    return repeatString(isDefined(padding) ? padding : ' ', num);
  }

  function truncateString(str, length, from, ellipsis, split) {
    var str1, str2, len1, len2;
    if (str.length <= length) {
      return str.toString();
    }
    ellipsis = isUndefined(ellipsis) ? '...' : ellipsis;
    switch(from) {
      case 'left':
        str2 = split ? truncateOnWord(str, length, true) : str.slice(str.length - length);
        return ellipsis + str2;
      case 'middle':
        len1 = ceil(length / 2);
        len2 = floor(length / 2);
        str1 = split ? truncateOnWord(str, len1) : str.slice(0, len1);
        str2 = split ? truncateOnWord(str, len2, true) : str.slice(str.length - len2);
        return str1 + ellipsis + str2;
      default:
        str1 = split ? truncateOnWord(str, length) : str.slice(0, length);
        return str1 + ellipsis;
    }
  }

  function stringEach(str, search, fn) {
    var chunks, chunk, reg, result = [];
    if (isFunction(search)) {
      fn = search;
      reg = /[\s\S]/g;
    } else if (!search) {
      reg = /[\s\S]/g;
    } else if (isString(search)) {
      reg = RegExp(escapeRegExp(search), 'gi');
    } else if (isRegExp(search)) {
      reg = RegExp(search.source, getRegExpFlags(search, 'g'));
    }
    // Getting the entire array of chunks up front as we need to
    // pass this into the callback function as an argument.
    chunks = runGlobalMatch(str, reg);

    if (chunks) {
      for(var i = 0, len = chunks.length, r; i < len; i++) {
        chunk = chunks[i];
        result[i] = chunk;
        if (fn) {
          r = fn.call(str, chunk, i, chunks);
          if (r === false) {
            break;
          } else if (isDefined(r)) {
            result[i] = r;
          }
        }
      }
    }
    return result;
  }

  // "match" in < IE9 has enumable properties that will confuse for..in
  // loops, so ensure that the match is a normal array by manually running
  // "exec". Note that this method is also slightly more performant.
  function runGlobalMatch(str, reg) {
    var result = [], match, lastLastIndex;
    while ((match = reg.exec(str)) != null) {
      if (reg.lastIndex === lastLastIndex) {
        reg.lastIndex += 1;
      } else {
        result.push(match[0]);
      }
      lastLastIndex = reg.lastIndex;
    }
    return result;
  }

  function eachWord(str, fn) {
    return stringEach(trim(str), /\S+/g, fn);
  }

  function stringCodes(str, fn) {
    var codes = new Array(str.length), i, len;
    for(i = 0, len = str.length; i < len; i++) {
      var code = str.charCodeAt(i);
      codes[i] = code;
      if (fn) {
        fn.call(str, code, i, str);
      }
    }
    return codes;
  }

  function stringUnderscore(str) {
    var areg = Inflections.acronyms && Inflections.acronyms.reg;
    // istanbul ignore if
    if (areg) {
      str = str.replace(areg, function(acronym, index) {
        return (index > 0 ? '_' : '') + acronym.toLowerCase();
      })
    }
    return str
      .replace(/[-\s]+/g, '_')
      .replace(/([A-Z\d]+)([A-Z][a-z])/g,'$1_$2')
      .replace(/([a-z\d])([A-Z])/g,'$1_$2')
      .toLowerCase();
  }

  function stringCamelize(str, upper) {
    str = stringUnderscore(str);
    return str.replace(CAMELIZE_REG, function(match, pre, word, index) {
      var cap = upper !== false || index > 0, acronym;
      acronym = getAcronym(word);
      // istanbul ignore if
      if (acronym && cap) {
        return acronym;
      }
      return cap ? stringCapitalize(word, true) : word;
    });
  }

  function stringSpacify(str) {
    return stringUnderscore(str).replace(/_/g, ' ');
  }

  function stringCapitalize(str, downcase, all) {
    if (downcase) {
      str = str.toLowerCase();
    }
    return all ? str.replace(CAPITALIZE_REG, simpleCapitalize) : simpleCapitalize(str);
  }

  function stringTitleize(str) {
    var fullStopPunctuation = /[.:;!]$/, lastHadPunctuation;
    str = runHumanRules(str);
    str = stringSpacify(str);
    return eachWord(str, function(word, index, words) {
      word = getHumanWord(word) || word;
      word = getAcronym(word) || word;
      var hasPunctuation, isFirstOrLast;
      var first = index == 0, last = index == words.length - 1;
      hasPunctuation = fullStopPunctuation.test(word);
      isFirstOrLast = first || last || hasPunctuation || lastHadPunctuation;
      lastHadPunctuation = hasPunctuation;
      if (isFirstOrLast || indexOf(DOWNCASED_WORDS, word) === -1) {
        return stringCapitalize(word, false, true);
      } else {
        return word;
      }
    }).join(' ');
  }

  function stringParameterize(str, separator) {
    if (separator === undefined) separator = '-';
    str = str.replace(/[^a-z0-9\-_]+/gi, separator);
    if (separator) {
      var reg = RegExp('^{s}+|{s}+$|({s}){s}+'.split('{s}').join(escapeRegExp(separator)), 'g');
      str = str.replace(reg, '$1');
    }
    return encodeURI(str.toLowerCase());
  }

  function reverseString(str) {
    return str.split('').reverse().join('');
  }

  function truncateOnWord(str, limit, fromLeft) {
    if (fromLeft) {
      return reverseString(truncateOnWord(reverseString(str), limit));
    }
    var words = str.split(TRUNC_REG);
    var count = 0;
    return filter(words, function(word) {
      count += word.length;
      return count <= limit;
    }).join('');
  }

  function unescapeHTML(str) {
    return str.replace(HTML_ENTITY_REG, function(full, hex, code) {
      var special = HTMLFromEntityMap[code];
      return special || chr(hex ? parseInt(code, 16) : +code);
    });
  }

  function tagIsVoid(tag) {
    return indexOf(HTML_VOID_ELEMENTS, tag.toLowerCase()) !== -1;
  }

  function stringReplaceAll(str, f, replace) {
    var i = 0, tokens;
    if (isString(f)) {
      f = RegExp(escapeRegExp(f), 'g');
    } else if (f && !f.global) {
      f = RegExp(f.source, getRegExpFlags(f, 'g'));
    }
    if (!replace) {
      replace = '';
    } else {
      tokens = replace;
      replace = function() {
        var t = tokens[i++];
        return t != null ? t : '';
      };
    }
    return str.replace(f, replace);
  }

  function replaceTags(str, find, replacement, strip) {
    var tags = isString(find) ? [find] : find, reg, src;
    tags = map(tags || [], function(t) {
      return escapeRegExp(t);
    }).join('|');
    src = tags.replace('all', '') || '[^\\s>]+';
    src = '<(\\/)?(' + src + ')(\\s+[^<>]*?)?\\s*(\\/)?>';
    reg = RegExp(src, 'gi');
    return runTagReplacements(str.toString(), reg, strip, replacement);
  }

  function runTagReplacements(str, reg, strip, replacement, fullString) {

    var match;
    var result = '';
    var currentIndex = 0;
    var openTagName;
    var openTagAttributes;
    var openTagCount = 0;

    function processTag(index, tagName, attributes, tagLength, isVoid) {
      var content = str.slice(currentIndex, index), s = '', r = '';
      if (isString(replacement)) {
        r = replacement;
      } else if (replacement) {
        r = replacement.call(fullString, tagName, content, attributes, fullString) || '';
      }
      if (strip) {
        s = r;
      } else {
        content = r;
      }
      if (content) {
        content = runTagReplacements(content, reg, strip, replacement, fullString);
      }
      result += s + content + (isVoid ? '' : s);
      currentIndex = index + (tagLength || 0);
    }

    fullString = fullString || str;
    reg = RegExp(reg.source, 'gi');

    while(match = reg.exec(str)) {

      var tagName         = match[2];
      var attributes      = (match[3]|| '').slice(1);
      var isClosingTag    = !!match[1];
      var isSelfClosing   = !!match[4];
      var tagLength       = match[0].length;
      var isVoid          = tagIsVoid(tagName);
      var isOpeningTag    = !isClosingTag && !isSelfClosing && !isVoid;
      var isSameAsCurrent = tagName === openTagName;

      if (!openTagName) {
        result += str.slice(currentIndex, match.index);
        currentIndex = match.index;
      }

      if (isOpeningTag) {
        if (!openTagName) {
          openTagName = tagName;
          openTagAttributes = attributes;
          openTagCount++;
          currentIndex += tagLength;
        } else if (isSameAsCurrent) {
          openTagCount++;
        }
      } else if (isClosingTag && isSameAsCurrent) {
        openTagCount--;
        if (openTagCount === 0) {
          processTag(match.index, openTagName, openTagAttributes, tagLength, isVoid);
          openTagName       = null;
          openTagAttributes = null;
        }
      } else if (!openTagName) {
        processTag(match.index, tagName, attributes, tagLength, isVoid);
      }
    }
    if (openTagName) {
      processTag(str.length, openTagName, openTagAttributes);
    }
    result += str.slice(currentIndex);
    return result;
  }

  function numberOrIndex(str, n, from) {
    if (isString(n)) {
      n = str.indexOf(n);
      if (n === -1) {
        n = from ? str.length : 0;
      }
    }
    return n;
  }

  function buildBase64() {
    var encodeAscii, decodeAscii;

    // istanbul ignore next
    function catchEncodingError(fn) {
      return function(str) {
        try {
          return fn(str);
        } catch(e) {
          return '';
        }
      };
    }

    // istanbul ignore if
    if (typeof Buffer !== 'undefined') {
      encodeBase64 = function(str) {
        return Buffer.from(str).toString('base64');
      };
      decodeBase64 = function(str) {
        return Buffer.from(str, 'base64').toString('utf8');
      };
      return;
    }

    // istanbul ignore if
    if (typeof btoa !== 'undefined') {
      encodeAscii = catchEncodingError(btoa);
      decodeAscii = catchEncodingError(atob);
    } else {
      var key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      var base64reg = /[^A-Za-z0-9\+\/\=]/g;
      encodeAscii = function(str) {
        var output = '';
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        do {
          chr1 = str.charCodeAt(i++);
          chr2 = str.charCodeAt(i++);
          chr3 = str.charCodeAt(i++);
          enc1 = chr1 >> 2;
          enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
          enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
          enc4 = chr3 & 63;
          if (isNaN(chr2)) {
            enc3 = enc4 = 64;
          } else if (isNaN(chr3)) {
            enc4 = 64;
          }
          output += key.charAt(enc1);
          output += key.charAt(enc2);
          output += key.charAt(enc3);
          output += key.charAt(enc4);
          chr1 = chr2 = chr3 = '';
          enc1 = enc2 = enc3 = enc4 = '';
        } while (i < str.length);
        return output;
      };
      decodeAscii = function(input) {
        var output = '';
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        if (input.match(base64reg)) {
          return '';
        }
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
        do {
          enc1 = key.indexOf(input.charAt(i++));
          enc2 = key.indexOf(input.charAt(i++));
          enc3 = key.indexOf(input.charAt(i++));
          enc4 = key.indexOf(input.charAt(i++));
          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;
          output = output + chr(chr1);
          if (enc3 != 64) {
            output = output + chr(chr2);
          }
          if (enc4 != 64) {
            output = output + chr(chr3);
          }
          chr1 = chr2 = chr3 = '';
          enc1 = enc2 = enc3 = enc4 = '';
        } while (i < input.length);
        return output;
      };
    }
    encodeBase64 = function(str) {
      return encodeAscii(unescape(encodeURIComponent(str)));
    };
    decodeBase64 = function(str) {
      return decodeURIComponent(escape(decodeAscii(str)));
    };
  }

  function buildEntities() {
    HTMLToEntityMap = {};
    forEachProperty(HTMLFromEntityMap, function(val, key) {
      HTMLToEntityMap[val] = '&' + key + ';';
    });
  }

  function callIncludesWithRegexSupport(str, search, position) {
    if (!isRegExp(search)) {
      return nativeIncludes.call(str, search, position);
    }
    if (position) {
      str = str.slice(position);
    }
    return search.test(str);
  }

  defineInstance(sugarString, {

    // Enhancment to String#includes to allow a regex.
    'includes': fixArgumentLength(callIncludesWithRegexSupport)

  }, [ENHANCEMENTS_FLAG, STRING_ENHANCEMENTS_FLAG]);

  defineInstance(sugarString, {

    
    'at': function(str, index, loop) {
      return getEntriesForIndexes(str, index, loop, true);
    },

    
    'escapeURL': function(str, param) {
      return param ? encodeURIComponent(str) : encodeURI(str);
    },

    
    'unescapeURL': function(str, param) {
      return param ? decodeURI(str) : decodeURIComponent(str);
    },

    
    'escapeHTML': function(str) {
      return str.replace(HTML_ESCAPE_REG, function(chr) {
        return getOwn(HTMLToEntityMap, chr);
      });
    },

    
    'unescapeHTML': function(str) {
      return unescapeHTML(str);
    },

    
    'stripTags': function(str, tag, replace) {
      return replaceTags(str, tag, replace, true);
    },

    
    'removeTags': function(str, tag, replace) {
      return replaceTags(str, tag, replace, false);
    },

    
    'encodeBase64': function(str) {
      return encodeBase64(str);
    },

    
    'decodeBase64': function(str) {
      return decodeBase64(str);
    },

    
    'forEach': function(str, search, eachFn) {
      return stringEach(str, search, eachFn);
    },

    
    'chars': function(str, search, eachCharFn) {
      return stringEach(str, search, eachCharFn);
    },

    
    'words': function(str, eachWordFn) {
      return stringEach(trim(str), /\S+/g, eachWordFn);
    },

    
    'lines': function(str, eachLineFn) {
      return stringEach(trim(str), /^.*$/gm, eachLineFn);
    },

    
    'codes': function(str, eachCodeFn) {
      return stringCodes(str, eachCodeFn);
    },

    
    'shift': function(str, n) {
      var result = '';
      n = n || 0;
      stringCodes(str, function(c) {
        result += chr(c + n);
      });
      return result;
    },

    
    'isBlank': function(str) {
      return trim(str).length === 0;
    },

    
    'isEmpty': function(str) {
      return str.length === 0;
    },

    
    'insert': function(str, substr, index) {
      index = isUndefined(index) ? str.length : index;
      return str.slice(0, index) + substr + str.slice(index);
    },

    
    'remove': function(str, f) {
      return str.replace(f, '');
    },

    
    'removeAll': function(str, f) {
      return stringReplaceAll(str, f);
    },

    
    'reverse': function(str) {
      return reverseString(str);
    },

    
    'compact': function(str) {
      return trim(str).replace(/([\r\n\s　])+/g, function(match, whitespace) {
        return whitespace === '　' ? whitespace : ' ';
      });
    },

    
    'from': function(str, from) {
      return str.slice(numberOrIndex(str, from, true));
    },

    
    'to': function(str, to) {
      if (isUndefined(to)) to = str.length;
      return str.slice(0, numberOrIndex(str, to));
    },

    
    'dasherize': function(str) {
      return stringUnderscore(str).replace(/_/g, '-');
    },

    
    'underscore': function(str) {
      return stringUnderscore(str);
    },

    
    'camelize': function(str, upper) {
      return stringCamelize(str, upper);
    },

    
    'spacify': function(str) {
      return stringSpacify(str);
    },

    
    'titleize': function(str) {
      return stringTitleize(str);
    },

    
    'parameterize': function(str, separator) {
      return stringParameterize(str, separator);
    },

    
    'truncate': function(str, length, from, ellipsis) {
      return truncateString(str, length, from, ellipsis);
    },

    
    'truncateOnWord': function(str, length, from, ellipsis) {
      return truncateString(str, length, from, ellipsis, true);
    },

    
    'pad': function(str, num, padding) {
      var half, front, back;
      num   = coercePositiveInteger(num);
      half  = max(0, num - str.length) / 2;
      front = floor(half);
      back  = ceil(half);
      return padString(front, padding) + str + padString(back, padding);
    },

    
    'padLeft': function(str, num, padding) {
      num = coercePositiveInteger(num);
      return padString(max(0, num - str.length), padding) + str;
    },

    
    'padRight': function(str, num, padding) {
      num = coercePositiveInteger(num);
      return str + padString(max(0, num - str.length), padding);
    },

    
    'first': function(str, num) {
      if (isUndefined(num)) num = 1;
      return str.substr(0, num);
    },

    
    'last': function(str, num) {
      if (isUndefined(num)) num = 1;
      var start = str.length - num < 0 ? 0 : str.length - num;
      return str.substr(start);
    },

    
    'toNumber': function(str, base) {
      return stringToNumber(str, base);
    },

    
    'capitalize': function(str, lower, all) {
      return stringCapitalize(str, lower, all);
    },

    
    'trimLeft': function(str) {
      return str.replace(LEFT_TRIM_REG, '');
    },

    
    'trimRight': function(str) {
      return str.replace(RIGHT_TRIM_REG, '');
    }

  });

  defineInstanceWithArguments(sugarString, {

    
    'replaceAll': function(str, f, args) {
      return stringReplaceAll(str, f, args);
    },

    
    'format': function(str, args) {
      var arg1 = args[0] && args[0].valueOf();
      // Unwrap if a single object is passed in.
      if (args.length === 1 && isObjectType(arg1)) {
        args = arg1;
      }
      return stringFormatMatcher(str, args);
    }

  });

  buildBase64();
  buildEntities();

  


  var NUMBER_OPTIONS = {
    'decimal': HALF_WIDTH_PERIOD,
    'thousands': HALF_WIDTH_COMMA
  };

  // Abbreviation Units
  var BASIC_UNITS         = '|kmbt',
      MEMORY_UNITS        = '|KMGTPE',
      MEMORY_BINARY_UNITS = '|,Ki,Mi,Gi,Ti,Pi,Ei',
      METRIC_UNITS_SHORT  = 'nμm|k',
      METRIC_UNITS_FULL   = 'yzafpnμm|KMGTPEZY';


  
  var _numberOptions = defineOptionsAccessor(sugarNumber, NUMBER_OPTIONS);


  function abbreviateNumber(num, precision, ustr, bytes) {
    var fixed        = num.toFixed(20),
        decimalPlace = fixed.search(/\./),
        numeralPlace = fixed.search(/[1-9]/),
        significant  = decimalPlace - numeralPlace,
        units, unit, mid, i, divisor;
    if (significant > 0) {
      significant -= 1;
    }
    units = commaSplit(ustr);
    if (units.length === 1) {
      units = ustr.split('');
    }
    mid = units.indexOf('|');
    if (mid === -1) {
      // Skipping the placeholder means the units should start from zero,
      // otherwise assume they end at zero.
      mid = units[0] === '_' ? 0 : units.length;
    }
    i = max(min(floor(significant / 3), units.length - mid - 1), -mid);
    unit = units[i + mid];
    while (unit === '_') {
      i += i < 0 ? -1 : 1;
      unit = units[i + mid];
    }
    if (unit === '|') {
      unit = '';
    }
    if (significant < -9) {
      precision = abs(significant) - 9;
    }
    divisor = bytes ? pow(2, 10 * i) : pow(10, i * 3);
    return numberFormat(withPrecision(num / divisor, precision || 0)) + unit;
  }

  function numberFormat(num, place) {
    var result = '', thousands, decimal, fraction, integer, split, str;

    decimal   = _numberOptions('decimal');
    thousands = _numberOptions('thousands');

    if (isNumber(place)) {
      str = withPrecision(num, place || 0).toFixed(max(place, 0));
    } else {
      str = num.toString();
    }

    str = str.replace(/^-/, '');
    split    = periodSplit(str);
    integer  = split[0];
    fraction = split[1];
    if (/e/.test(str)) {
      result = str;
    } else {
      for(var i = integer.length; i > 0; i -= 3) {
        if (i < integer.length) {
          result = thousands + result;
        }
        result = integer.slice(max(0, i - 3), i) + result;
      }
    }
    if (fraction) {
      result += decimal + repeatString('0', (place || 0) - fraction.length) + fraction;
    }
    return (num < 0 ? '-' : '') + result;
  }

  function isInteger(n) {
    return n % 1 === 0;
  }

  function isMultipleOf(n1, n2) {
    return n1 % n2 === 0;
  }

  function createRoundingFunction(fn) {
    return function(n, precision) {
      return precision ? withPrecision(n, precision, fn) : fn(n);
    };
  }

  defineStatic(sugarNumber, {

    
    'random': function(n1, n2) {
      var minNum, maxNum;
      if (arguments.length == 1) n2 = n1, n1 = 0;
      minNum = min(n1 || 0, isUndefined(n2) ? 1 : n2);
      maxNum = max(n1 || 0, isUndefined(n2) ? 1 : n2) + 1;
      return trunc((Math.random() * (maxNum - minNum)) + minNum);
    }

  });

  defineInstance(sugarNumber, {

    
    'isInteger': function(n) {
      return isInteger(n);
    },

    
    'isOdd': function(n) {
      return isInteger(n) && !isMultipleOf(n, 2);
    },

    
    'isEven': function(n) {
      return isMultipleOf(n, 2);
    },

    
    'isMultipleOf': function(n, num) {
      return isMultipleOf(n, num);
    },

    
    'log': function(n, base) {
      return Math.log(n) / (base ? Math.log(base) : 1);
    },

    
    'abbr': function(n, precision) {
      return abbreviateNumber(n, precision, BASIC_UNITS);
    },

    
    'metric': function(n, precision, units) {
      if (units === 'all') {
        units = METRIC_UNITS_FULL;
      } else if (!units) {
        units = METRIC_UNITS_SHORT;
      }
      return abbreviateNumber(n, precision, units);
    },

    
    'bytes': function(n, precision, binary, units) {
      if (units === 'binary' || (!units && binary)) {
        units = MEMORY_BINARY_UNITS;
      } else if(units === 'si' || !units) {
        units = MEMORY_UNITS;
      }
      return abbreviateNumber(n, precision, units, binary) + 'B';
    },

    
    'format': function(n, place) {
      return numberFormat(n, place);
    },

    
    'hex': function(n, pad) {
      return padNumber(n, pad || 1, false, 16);
    },

    
    'times': function(n, indexMapFn) {
      var arr, result;
      for(var i = 0; i < n; i++) {
        result = indexMapFn.call(n, i);
        if (isDefined(result)) {
          if (!arr) {
            arr = [];
          }
          arr.push(result);
        }
      }
      return arr;
    },

    
    'chr': function(n) {
      return chr(n);
    },

    
    'pad': function(n, place, sign, base) {
      return padNumber(n, place, sign, base);
    },

    
    'ordinalize': function(n) {
      var num = abs(n), last = +num.toString().slice(-2);
      return n + getOrdinalSuffix(last);
    },

    
    'toNumber': function(n) {
      return n.valueOf();
    },

    
    'round': createRoundingFunction(round),

    
    'ceil': createRoundingFunction(ceil),

    
    'floor': createRoundingFunction(floor)

  });

  
  function buildMathAliases() {
    defineInstanceSimilar(sugarNumber, 'abs pow sin asin cos acos tan atan exp pow sqrt', function(methods, name) {
      methods[name] = function(n, arg) {
        // Note that .valueOf() here is only required due to a
        // very strange bug in iOS7 that only occurs occasionally
        // in which Math.abs() called on non-primitive numbers
        // returns a completely different number (Issue #400)
        return Math[name](n.valueOf(), arg);
      };
    });
  }

  buildMathAliases();

  

  var HALF_WIDTH_NINE = 0x39;
  var FULL_WIDTH_NINE = 0xff19;

  // Undefined array elements in < IE8 will not be visited by concat
  // and so will not be copied. This means that non-sparse arrays will
  // become sparse, so detect for this here.
  var HAS_CONCAT_BUG = !('0' in [].concat(undefined).concat());

  var ARRAY_OPTIONS = {
    'sortIgnore':      null,
    'sortNatural':     true,
    'sortIgnoreCase':  true,
    'sortOrder':       getSortOrder(),
    'sortCollate':     collateStrings,
    'sortEquivalents': getSortEquivalents()
  };

  
  var _arrayOptions = defineOptionsAccessor(sugarArray, ARRAY_OPTIONS);


  function setArrayChainableConstructor() {
    setChainableConstructor(sugarArray, arrayCreate);
  }

  function isArrayOrInherited(obj) {
    return obj && obj.constructor && isArray(obj.constructor.prototype);
  }

  function arrayCreate(obj, clone) {
    var arr;
    if (isArrayOrInherited(obj)) {
      arr = clone ? arrayClone(obj) : obj;
    } else if (isObjectType(obj) || isString(obj)) {
      arr = Array.from(obj);
    } else if (isDefined(obj)) {
      arr = [obj];
    }
    return arr || [];
  }

  function arrayClone(arr) {
    var clone = new Array(arr.length);
    forEach(arr, function(el, i) {
      clone[i] = el;
    });
    return clone;
  }

  function arrayConcat(arr1, arr2) {
    // istanbul ignore if
    if (HAS_CONCAT_BUG) {
      return arraySafeConcat(arr1, arr2);
    }
    return arr1.concat(arr2);
  }

  // Avoids issues with [undefined] in < IE9
  function arrayWrap(obj) {
    var arr = [];
    arr.push(obj);
    return arr;
  }

  // Avoids issues with concat in < IE8
  // istanbul ignore next
  function arraySafeConcat(arr, arg) {
    var result = arrayClone(arr), len = result.length, arr2;
    arr2 = isArray(arg) ? arg : [arg];
    result.length += arr2.length;
    forEach(arr2, function(el, i) {
      result[len + i] = el;
    });
    return result;
  }


  function arrayAppend(arr, el, index) {
    var spliceArgs;
    index = +index;
    if (isNaN(index)) {
      index = arr.length;
    }
    spliceArgs = [index, 0];
    if (isDefined(el)) {
      spliceArgs = spliceArgs.concat(el);
    }
    arr.splice.apply(arr, spliceArgs);
    return arr;
  }

  function arrayRemove(arr, f) {
    var matcher = getMatcher(f), i = 0;
    while(i < arr.length) {
      if (matcher(arr[i], i, arr)) {
        arr.splice(i, 1);
      } else {
        i++;
      }
    }
    return arr;
  }

  function arrayExclude(arr, f) {
    var result = [], matcher = getMatcher(f);
    for (var i = 0; i < arr.length; i++) {
      if (!matcher(arr[i], i, arr)) {
        result.push(arr[i]);
      }
    }
    return result;
  }

  function arrayUnique(arr, map) {
    var result = [], obj = {}, refs = [];
    forEach(arr, function(el, i) {
      var transformed = map ? mapWithShortcuts(el, map, arr, [el, i, arr]) : el;
      var key = serializeInternal(transformed, refs);
      if (!hasOwn(obj, key)) {
        result.push(el);
        obj[key] = true;
      }
    });
    return result;
  }

  function arrayFlatten(arr, level, current) {
    var result = [];
    level = level || Infinity;
    current = current || 0;
    forEach(arr, function(el) {
      if (isArray(el) && current < level) {
        result = result.concat(arrayFlatten(el, level, current + 1));
      } else {
        result.push(el);
      }
    });
    return result;
  }

  function arrayCompact(arr, all) {
    return filter(arr, function(el) {
      return el || (!all && el != null && el.valueOf() === el.valueOf());
    });
  }

  function arrayShuffle(arr) {
    arr = arrayClone(arr);
    var i = arr.length, j, x;
    while(i) {
      j = (Math.random() * i) | 0;
      x = arr[--i];
      arr[i] = arr[j];
      arr[j] = x;
    }
    return arr;
  }

  function arrayGroupBy(arr, map, fn) {
    var result = {}, key;
    forEach(arr, function(el, i) {
      key = mapWithShortcuts(el, map, arr, [el, i, arr]);
      if (!hasOwn(result, key)) {
        result[key] = [];
      }
      result[key].push(el);
    });
    if (fn) {
      forEachProperty(result, fn);
    }
    return result;
  }

  function arrayIntersectOrSubtract(arr1, arr2, subtract) {
    var result = [], obj = {}, refs = [];
    if (!isArray(arr2)) {
      arr2 = arrayWrap(arr2);
    }
    forEach(arr2, function(el) {
      obj[serializeInternal(el, refs)] = true;
    });
    forEach(arr1, function(el) {
      var key = serializeInternal(el, refs);
      if (hasOwn(obj, key) !== subtract) {
        delete obj[key];
        result.push(el);
      }
    });
    return result;
  }

  // Collation helpers

  function compareValue(aVal, bVal) {
    var cmp, i, collate;
    if (isString(aVal) && isString(bVal)) {
      collate = _arrayOptions('sortCollate');
      return collate(aVal, bVal);
    } else if (isArray(aVal) && isArray(bVal)) {
      if (aVal.length < bVal.length) {
        return -1;
      } else if (aVal.length > bVal.length) {
        return 1;
      } else {
        for(i = 0; i < aVal.length; i++) {
          cmp = compareValue(aVal[i], bVal[i]);
          if (cmp !== 0) {
            return cmp;
          }
        }
        return 0;
      }
    }
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  }

  function codeIsNumeral(code) {
    return (code >= HALF_WIDTH_ZERO && code <= HALF_WIDTH_NINE) ||
           (code >= FULL_WIDTH_ZERO && code <= FULL_WIDTH_NINE);
  }

  function collateStrings(a, b) {
    var aValue, bValue, aChar, bChar, aEquiv, bEquiv, index = 0, tiebreaker = 0;

    var sortOrder       = _arrayOptions('sortOrder');
    var sortIgnore      = _arrayOptions('sortIgnore');
    var sortNatural     = _arrayOptions('sortNatural');
    var sortIgnoreCase  = _arrayOptions('sortIgnoreCase');
    var sortEquivalents = _arrayOptions('sortEquivalents');

    a = getCollationReadyString(a, sortIgnore, sortIgnoreCase);
    b = getCollationReadyString(b, sortIgnore, sortIgnoreCase);

    do {

      aChar  = getCollationCharacter(a, index, sortEquivalents);
      bChar  = getCollationCharacter(b, index, sortEquivalents);
      aValue = getSortOrderIndex(aChar, sortOrder);
      bValue = getSortOrderIndex(bChar, sortOrder);

      if (aValue === -1 || bValue === -1) {
        aValue = a.charCodeAt(index) || null;
        bValue = b.charCodeAt(index) || null;
        if (sortNatural && codeIsNumeral(aValue) && codeIsNumeral(bValue)) {
          aValue = stringToNumber(a.slice(index));
          bValue = stringToNumber(b.slice(index));
        }
      } else {
        aEquiv = aChar !== a.charAt(index);
        bEquiv = bChar !== b.charAt(index);
        if (aEquiv !== bEquiv && tiebreaker === 0) {
          tiebreaker = aEquiv - bEquiv;
        }
      }
      index += 1;
    } while(aValue != null && bValue != null && aValue === bValue);
    if (aValue === bValue) return tiebreaker;
    return aValue - bValue;
  }

  function getCollationReadyString(str, sortIgnore, sortIgnoreCase) {
    if (sortIgnoreCase) {
      str = str.toLowerCase();
    }
    if (sortIgnore) {
      str = str.replace(sortIgnore, '');
    }
    return str;
  }

  function getCollationCharacter(str, index, sortEquivalents) {
    var chr = str.charAt(index);
    return getOwn(sortEquivalents, chr) || chr;
  }

  function getSortOrderIndex(chr, sortOrder) {
    if (!chr) {
      return null;
    } else {
      return sortOrder.indexOf(chr);
    }
  }

  function getSortOrder() {
    var order = 'AÁÀÂÃĄBCĆČÇDĎÐEÉÈĚÊËĘFGĞHıIÍÌİÎÏJKLŁMNŃŇÑOÓÒÔPQRŘSŚŠŞTŤUÚÙŮÛÜVWXYÝZŹŻŽÞÆŒØÕÅÄÖ';
    return map(order.split(''), function(str) {
      return str + str.toLowerCase();
    }).join('');
  }

  function getSortEquivalents() {
    var equivalents = {};
    forEach(spaceSplit('AÁÀÂÃÄ CÇ EÉÈÊË IÍÌİÎÏ OÓÒÔÕÖ Sß UÚÙÛÜ'), function(set) {
      var first = set.charAt(0);
      forEach(set.slice(1).split(''), function(chr) {
        equivalents[chr] = first;
        equivalents[chr.toLowerCase()] = first.toLowerCase();
      });
    });
    return equivalents;
  }

  defineStatic(sugarArray, {

    
    'create': function(obj, clone) {
      return arrayCreate(obj, clone);
    },

    
    'construct': function(n, indexMapFn) {
      n = coercePositiveInteger(n);
      return Array.from(new Array(n), function(el, i) {
        return indexMapFn && indexMapFn(i);
      });
    }

  });

  defineInstance(sugarArray, {

    
    'isEmpty': function(arr) {
      return arr.length === 0;
    },

    
    'isEqual': function(a, b) {
      return isEqual(a, b);
    },

    
    'clone': function(arr) {
      return arrayClone(arr);
    },

    
    'at': function(arr, index, loop) {
      return getEntriesForIndexes(arr, index, loop);
    },

    
    'add': function(arr, item, index) {
      return arrayAppend(arrayClone(arr), item, index);
    },

    
    'subtract': function(arr, item) {
      return arrayIntersectOrSubtract(arr, item, true);
    },

    
    'append': function(arr, item, index) {
      return arrayAppend(arr, item, index);
    },

    
    'removeAt': function(arr, start, end) {
      if (isUndefined(start)) return arr;
      if (isUndefined(end))   end = start;
      arr.splice(start, end - start + 1);
      return arr;
    },

    
    'unique': function(arr, map) {
      return arrayUnique(arr, map);
    },

    
    'flatten': function(arr, limit) {
      return arrayFlatten(arr, limit);
    },

    
    'first': function(arr, num) {
      if (isUndefined(num)) return arr[0];
      if (num < 0) num = 0;
      return arr.slice(0, num);
    },

    
    'last': function(arr, num) {
      if (isUndefined(num)) return arr[arr.length - 1];
      var start = arr.length - num < 0 ? 0 : arr.length - num;
      return arr.slice(start);
    },

    
    'from': function(arr, num) {
      return arr.slice(num);
    },

    
    'to': function(arr, num) {
      if (isUndefined(num)) num = arr.length;
      return arr.slice(0, num);
    },

    
    'compact': function(arr, all) {
      return arrayCompact(arr, all);
    },

    
    'groupBy': function(arr, map, groupFn) {
      return arrayGroupBy(arr, map, groupFn);
    },

    
    'inGroups': function(arr, num, padding) {
      var pad = isDefined(padding);
      var result = new Array(num);
      var divisor = ceil(arr.length / num);
      simpleRepeat(num, function(i) {
        var index = i * divisor;
        var group = arr.slice(index, index + divisor);
        if (pad && group.length < divisor) {
          simpleRepeat(divisor - group.length, function() {
            group.push(padding);
          });
        }
        result[i] = group;
      });
      return result;
    },

    
    'inGroupsOf': function(arr, num, padding) {
      var result = [], len = arr.length, group;
      if (len === 0 || num === 0) return arr;
      if (isUndefined(num)) num = 1;
      if (isUndefined(padding)) padding = null;
      simpleRepeat(ceil(len / num), function(i) {
        group = arr.slice(num * i, num * i + num);
        while(group.length < num) {
          group.push(padding);
        }
        result.push(group);
      });
      return result;
    },

    
    'shuffle': function(arr) {
      return arrayShuffle(arr);
    },

    
    'sample': function(arr, arg1, arg2) {
      var result = [], num, remove, single;
      if (isBoolean(arg1)) {
        remove = arg1;
      } else {
        num = arg1;
        remove = arg2;
      }
      if (isUndefined(num)) {
        num = 1;
        single = true;
      }
      if (!remove) {
        arr = arrayClone(arr);
      }
      num = min(num, arr.length);
      for (var i = 0, index; i < num; i++) {
        index = trunc(Math.random() * arr.length);
        result.push(arr[index]);
        arr.splice(index, 1);
      }
      return single ? result[0] : result;
    },

    
    'sortBy': function(arr, map, desc) {
      arr.sort(function(a, b) {
        var aProperty = mapWithShortcuts(a, map, arr, [a]);
        var bProperty = mapWithShortcuts(b, map, arr, [b]);
        return compareValue(aProperty, bProperty) * (desc ? -1 : 1);
      });
      return arr;
    },

    
    'remove': function(arr, f) {
      return arrayRemove(arr, f);
    },

    
    'exclude': function(arr, f) {
      return arrayExclude(arr, f);
    },

    
    'union': function(arr1, arr2) {
      return arrayUnique(arrayConcat(arr1, arr2));
    },

    
    'intersect': function(arr1, arr2) {
      return arrayIntersectOrSubtract(arr1, arr2, false);
    }

  });

  defineInstanceWithArguments(sugarArray, {

    
    'zip': function(arr, args) {
      return map(arr, function(el, i) {
        return [el].concat(map(args, function(k) {
          return (i in k) ? k[i] : null;
        }));
      });
    }

  });

  
  alias(sugarArray, 'insert', 'append');

  setArrayChainableConstructor();

  

  function sum(obj, map) {
    var sum = 0;
    enumerateWithMapping(obj, map, function(val) {
      sum += val;
    });
    return sum;
  }

  function average(obj, map) {
    var sum = 0, count = 0;
    enumerateWithMapping(obj, map, function(val) {
      sum += val;
      count++;
    });
    // Prevent divide by 0
    return sum / (count || 1);
  }

  function median(obj, map) {
    var result = [], middle, len;
    enumerateWithMapping(obj, map, function(val) {
      result.push(val);
    });
    len = result.length;
    if (!len) return 0;
    result.sort(function(a, b) {
      // IE7 will throw errors on non-numbers!
      return (a || 0) - (b || 0);
    });
    middle = trunc(len / 2);
    return len % 2 ? result[middle] : (result[middle - 1] + result[middle]) / 2;
  }

  function getMinOrMax(obj, arg1, arg2, max, asObject) {
    var result = [], pushVal, edge, all, map;
    if (isBoolean(arg1)) {
      all = arg1;
      map = arg2;
    } else {
      map = arg1;
    }
    enumerateWithMapping(obj, map, function(val, key) {
      if (isUndefined(val)) {
        throw new TypeError('Cannot compare with undefined');
      }
      pushVal = asObject ? key : obj[key];
      if (val === edge) {
        result.push(pushVal);
      } else if (isUndefined(edge) || (max && val > edge) || (!max && val < edge)) {
        result = [pushVal];
        edge = val;
      }
    });
    return getReducedMinMaxResult(result, obj, all, asObject);
  }

  function getLeastOrMost(obj, arg1, arg2, most, asObject) {
    var group = {}, refs = [], minMaxResult, result, all, map;
    if (isBoolean(arg1)) {
      all = arg1;
      map = arg2;
    } else {
      map = arg1;
    }
    enumerateWithMapping(obj, map, function(val, key) {
      var groupKey = serializeInternal(val, refs);
      var arr = getOwn(group, groupKey) || [];
      arr.push(asObject ? key : obj[key]);
      group[groupKey] = arr;
    });
    minMaxResult = getMinOrMax(group, !!all, 'length', most, true);
    if (all) {
      result = [];
      // Flatten result
      forEachProperty(minMaxResult, function(val) {
        result = result.concat(val);
      });
    } else {
      result = getOwn(group, minMaxResult);
    }
    return getReducedMinMaxResult(result, obj, all, asObject);
  }


  // Support

  function getReducedMinMaxResult(result, obj, all, asObject) {
    if (asObject && all) {
      // The method has returned an array of keys so use this array
      // to build up the resulting object in the form we want it in.
      return result.reduce(function(o, key) {
        o[key] = obj[key];
        return o;
      }, {});
    } else if (result && !all) {
      result = result[0];
    }
    return result;
  }

  function enumerateWithMapping(obj, map, fn) {
    var arrayIndexes = isArray(obj);
    forEachProperty(obj, function(val, key) {
      if (arrayIndexes) {
        if (!isArrayIndex(key)) {
          return;
        }
        key = +key;
      }
      var mapped = mapWithShortcuts(val, map, obj, [val, key, obj]);
      fn(mapped, key);
    });
  }

  

  // Flag allowing native array methods to be enhanced
  var ARRAY_ENHANCEMENTS_FLAG = 'enhanceArray';

  // Enhanced map function
  var enhancedMap = buildEnhancedMapping('map');

  // Enhanced matcher methods
  var enhancedFind      = buildEnhancedMatching('find'),
      enhancedSome      = buildEnhancedMatching('some'),
      enhancedEvery     = buildEnhancedMatching('every'),
      enhancedFilter    = buildEnhancedMatching('filter'),
      enhancedFindIndex = buildEnhancedMatching('findIndex');

  function arrayNone() {
    return !enhancedSome.apply(this, arguments);
  }

  function arrayCount(arr, f) {
    if (isUndefined(f)) {
      return arr.length;
    }
    return enhancedFilter.apply(this, arguments).length;
  }

  // Enhanced methods

  function buildEnhancedMapping(name) {
    return wrapNativeArrayMethod(name, enhancedMapping);
  }


  function buildEnhancedMatching(name) {
    return wrapNativeArrayMethod(name, enhancedMatching);
  }

  function enhancedMapping(map, context) {
    if (isFunction(map)) {
      return map;
    } else if (map) {
      return function(el, i, arr) {
        return mapWithShortcuts(el, map, context, [el, i, arr]);
      };
    }
  }

  function enhancedMatching(f) {
    var matcher;
    if (isFunction(f)) {
      return f;
    }
    matcher = getMatcher(f);
    return function(el, i, arr) {
      return matcher(el, i, arr);
    };
  }

  function wrapNativeArrayMethod(methodName, wrapper) {
    var nativeFn = Array.prototype[methodName];
    return function(arr, f, context, argsLen) {
      var args = new Array(2);
      assertArgument(argsLen > 0);
      args[0] = wrapper(f, context);
      args[1] = context;
      return nativeFn.apply(arr, args);
    };
  }


  
  function buildFromIndexMethods() {

    var methods = {
      'forEach': {
        base: forEachAsNative
      },
      'map': {
        wrapper: enhancedMapping
      },
      'some every': {
        wrapper: enhancedMatching
      },
      'findIndex': {
        wrapper: enhancedMatching,
        result: indexResult
      },
      'reduce': {
        apply: applyReduce
      },
      'filter find': {
        wrapper: enhancedMatching
      },
      'reduceRight': {
        apply: applyReduce,
        slice: sliceArrayFromRight,
        clamp: clampStartIndexFromRight
      }
    };

    forEachProperty(methods, function(opts, key) {
      forEach(spaceSplit(key), function(baseName) {
        var methodName = baseName + 'FromIndex';
        var fn = createFromIndexWithOptions(baseName, opts);
        defineInstanceWithArguments(sugarArray, methodName, fn);
      });
    });

    function forEachAsNative(fn) {
      forEach(this, fn);
    }

    // Methods like filter and find have a direct association between the value
    // returned by the callback and the element of the current iteration. This
    // means that when looping, array elements must match the actual index for
    // which they are being called, so the array must be sliced. This is not the
    // case for methods like forEach and map, which either do not use return
    // values or use them in a way that simply getting the element at a shifted
    // index will not affect the final return value. However, these methods will
    // still fail on sparse arrays, so always slicing them here. For example, if
    // "forEachFromIndex" were to be called on [1,,2] from index 1, although the
    // actual index 1 would itself would be skipped, when the array loops back to
    // index 0, shifting it by adding 1 would result in the element for that
    // iteration being undefined. For shifting to work, all gaps in the array
    // between the actual index and the shifted index would have to be accounted
    // for. This is infeasible and is easily solved by simply slicing the actual
    // array instead so that gaps align. Note also that in the case of forEach,
    // we are using the internal function which handles sparse arrays in a way
    // that does not increment the index, and so is highly optimized compared to
    // the others here, which are simply going through the native implementation.
    function sliceArrayFromLeft(arr, startIndex, loop) {
      var result = arr;
      if (startIndex) {
        result = arr.slice(startIndex);
        if (loop) {
          result = result.concat(arr.slice(0, startIndex));
        }
      }
      return result;
    }

    // When iterating from the right, indexes are effectively shifted by 1.
    // For example, iterating from the right from index 2 in an array of 3
    // should also include the last element in the array. This matches the
    // "lastIndexOf" method which also iterates from the right.
    function sliceArrayFromRight(arr, startIndex, loop) {
      if (!loop) {
        startIndex += 1;
        arr = arr.slice(0, max(0, startIndex));
      }
      return arr;
    }

    function clampStartIndex(startIndex, len) {
      return min(len, max(0, startIndex));
    }

    // As indexes are shifted by 1 when starting from the right, clamping has to
    // go down to -1 to accommodate the full range of the sliced array.
    function clampStartIndexFromRight(startIndex, len) {
      return min(len, max(-1, startIndex));
    }

    function applyReduce(arr, startIndex, fn, context, len, loop) {
      return function(acc, val, i) {
        i = getNormalizedIndex(i + startIndex, len, loop);
        return fn.call(arr, acc, val, i, arr);
      };
    }

    function applyEach(arr, startIndex, fn, context, len, loop) {
      return function(el, i) {
        i = getNormalizedIndex(i + startIndex, len, loop);
        return fn.call(context, arr[i], i, arr);
      };
    }

    function indexResult(result, startIndex, len) {
      if (result !== -1) {
        result = (result + startIndex) % len;
      }
      return result;
    }

    function createFromIndexWithOptions(methodName, opts) {

      var baseFn = opts.base || Array.prototype[methodName],
          applyCallback = opts.apply || applyEach,
          sliceArray = opts.slice || sliceArrayFromLeft,
          clampIndex = opts.clamp || clampStartIndex,
          getResult = opts.result,
          wrapper = opts.wrapper;

      return function(arr, startIndex, args) {
        var callArgs = [], argIndex = 0, lastArg, result, len, loop, fn;
        len = arr.length;
        if (isBoolean(args[0])) {
          loop = args[argIndex++];
        }
        fn = args[argIndex++];
        lastArg = args[argIndex];
        if (startIndex < 0) {
          startIndex += len;
        }
        startIndex = clampIndex(startIndex, len);
        assertArgument(args.length);
        fn = wrapper ? wrapper(fn, lastArg) : fn;
        callArgs.push(applyCallback(arr, startIndex, fn, lastArg, len, loop));
        if (lastArg) {
          callArgs.push(lastArg);
        }
        result = baseFn.apply(sliceArray(arr, startIndex, loop), callArgs);
        if (getResult) {
          result = getResult(result, startIndex, len);
        }
        return result;
      };
    }
  }

  defineInstance(sugarArray, {

    
    'map': fixArgumentLength(enhancedMap),

    
    'some': fixArgumentLength(enhancedSome),

    
    'every': fixArgumentLength(enhancedEvery),

    
    'filter': fixArgumentLength(enhancedFilter),

    
    'find': fixArgumentLength(enhancedFind),

    
    'findIndex': fixArgumentLength(enhancedFindIndex)

  }, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);


  defineInstance(sugarArray, {

    
    'none': fixArgumentLength(arrayNone),

    
    'count': fixArgumentLength(arrayCount),

    
    'min': function(arr, all, map) {
      return getMinOrMax(arr, all, map);
    },

    
    'max': function(arr, all, map) {
      return getMinOrMax(arr, all, map, true);
    },

    
    'least': function(arr, all, map) {
      return getLeastOrMost(arr, all, map);
    },

    
    'most': function(arr, all, map) {
      return getLeastOrMost(arr, all, map, true);
    },

    
    'sum': function(arr, map) {
      return sum(arr, map);
    },

    
    'average': function(arr, map) {
      return average(arr, map);
    },

    
    'median': function(arr, map) {
      return median(arr, map);
    }

  });


  

  // Object matchers
  var objectSome  = wrapObjectMatcher('some'),
      objectFind  = wrapObjectMatcher('find'),
      objectEvery = wrapObjectMatcher('every');

  function objectForEach(obj, fn) {
    assertCallable(fn);
    forEachProperty(obj, function(val, key) {
      fn(val, key, obj);
    });
    return obj;
  }

  function objectMap(obj, map) {
    var result = {};
    forEachProperty(obj, function(val, key) {
      result[key] = mapWithShortcuts(val, map, obj, [val, key, obj]);
    });
    return result;
  }

  function objectReduce(obj, fn, acc) {
    var init = isDefined(acc);
    forEachProperty(obj, function(val, key) {
      if (!init) {
        acc = val;
        init = true;
        return;
      }
      acc = fn(acc, val, key, obj);
    });
    return acc;
  }

  function objectNone(obj, f) {
    return !objectSome(obj, f);
  }

  function objectFilter(obj, f) {
    var matcher = getMatcher(f), result = {};
    forEachProperty(obj, function(val, key) {
      if (matcher(val, key, obj)) {
        result[key] = val;
      }
    });
    return result;
  }

  function objectCount(obj, f) {
    var matcher = getMatcher(f), count = 0;
    forEachProperty(obj, function(val, key) {
      if (matcher(val, key, obj)) {
        count++;
      }
    });
    return count;
  }

  // Support

  function wrapObjectMatcher(name) {
    var nativeFn = Array.prototype[name];
    return function(obj, f) {
      var matcher = getMatcher(f);
      return nativeFn.call(getKeys(obj), function(key) {
        return matcher(obj[key], key, obj);
      });
    };
  }

  defineInstanceAndStatic(sugarObject, {

    
    'forEach': function(obj, eachFn) {
      return objectForEach(obj, eachFn);
    },

    
    'map': function(obj, map) {
      return objectMap(obj, map);
    },

    
    'some': objectSome,

    
    'every': objectEvery,

    
    'filter': function(obj, f) {
      return objectFilter(obj, f);
    },

    
    'reduce': function(obj, fn, init) {
      return objectReduce(obj, fn, init);
    },

    
    'find': objectFind,

    
    'count': function(obj, f) {
      return objectCount(obj, f);
    },

    
    'none': function(obj, f) {
      return objectNone(obj, f);
    },

    
    'sum': function(obj, map) {
      return sum(obj, map);
    },

    
    'average': function(obj, map) {
      return average(obj, map);
    },

    
    'median': function(obj, map) {
      return median(obj, map);
    },

    
    'min': function(obj, all, map) {
      return getMinOrMax(obj, all, map, false, true);
    },

    
    'max': function(obj, all, map) {
      return getMinOrMax(obj, all, map, true, true);
    },

    
    'least': function(obj, all, map) {
      return getLeastOrMost(obj, all, map, false, true);
    },

    
    'most': function(obj, all, map) {
      return getLeastOrMost(obj, all, map, true, true);
    }

  });


  buildFromIndexMethods();

  

  // Matches bracket-style query strings like user[name]
  var DEEP_QUERY_STRING_REG = /^(.+?)(\[.*\])$/;

  // Matches any character not allowed in a decimal number.
  var NON_DECIMAL_REG = /[^\d.-]/;

  // Native methods for merging by descriptor when available.
  var getOwnPropertyNames      = Object.getOwnPropertyNames;
  var getOwnPropertySymbols    = Object.getOwnPropertySymbols;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  // Basic Helpers

  function isArguments(obj, className) {
    className = className || classToString(obj);
    // .callee exists on Arguments objects in < IE8
    return hasProperty(obj, 'length') && (className === '[object Arguments]' || !!obj.callee);
  }

  // Query Strings | Creating

  function toQueryStringWithOptions(obj, opts) {
    opts = opts || {};
    if (isUndefined(opts.separator)) {
      opts.separator = '_';
    }
    return toQueryString(obj, opts.deep, opts.transform, opts.prefix || '', opts.separator);
  }

  function toQueryString(obj, deep, transform, prefix, separator) {
    if (isArray(obj)) {
      return collectArrayAsQueryString(obj, deep, transform, prefix, separator);
    } else if (isObjectType(obj) && obj.toString === internalToString) {
      return collectObjectAsQueryString(obj, deep, transform, prefix, separator);
    } else if (prefix) {
      return getURIComponentValue(obj, prefix, transform);
    }
    return '';
  }

  function collectArrayAsQueryString(arr, deep, transform, prefix, separator) {
    var el, qc, key, result = [];
    // Intentionally treating sparse arrays as dense here by avoiding map,
    // otherwise indexes will shift during the process of serialization.
    for (var i = 0, len = arr.length; i < len; i++) {
      el = arr[i];
      key = prefix + (prefix && deep ? '[]' : '');
      if (!key && !isObjectType(el)) {
        // If there is no key, then the values of the array should be
        // considered as null keys, so use them instead;
        qc = sanitizeURIComponent(el);
      } else {
        qc = toQueryString(el, deep, transform, key, separator);
      }
      result.push(qc);
    }
    return result.join('&');
  }

  function collectObjectAsQueryString(obj, deep, transform, prefix, separator) {
    var result = [];
    forEachProperty(obj, function(val, key) {
      var fullKey;
      if (prefix && deep) {
        fullKey = prefix + '[' + key + ']';
      } else if (prefix) {
        fullKey = prefix + separator + key;
      } else {
        fullKey = key;
      }
      result.push(toQueryString(val, deep, transform, fullKey, separator));
    });
    return result.join('&');
  }

  function getURIComponentValue(obj, prefix, transform) {
    var value;
    if (transform) {
      value = transform(obj, prefix);
    } else if (isDate(obj)) {
      value = obj.getTime();
    } else {
      value = obj;
    }
    return sanitizeURIComponent(prefix) + '=' + sanitizeURIComponent(value);
  }

  function sanitizeURIComponent(obj) {
    // undefined, null, and NaN are represented as a blank string,
    // while false and 0 are stringified.
    return !obj && obj !== false && obj !== 0 ? '' : encodeURIComponent(obj);
  }


  // Query Strings | Parsing

  function fromQueryStringWithOptions(obj, opts) {
    var str = String(obj || '').replace(/^.*?\?/, ''), result = {}, auto;
    opts = opts || {};
    if (str) {
      forEach(str.split('&'), function(p) {
        var split = p.split('=');
        var key = decodeURIComponent(split[0]);
        var val = split.length === 2 ? decodeURIComponent(split[1]) : '';
        auto = opts.auto !== false;
        parseQueryComponent(result, key, val, opts.deep, auto, opts.separator, opts.transform);
      });
    }
    return result;
  }

  function parseQueryComponent(obj, key, val, deep, auto, separator, transform) {
    var match;
    if (separator) {
      key = mapQuerySeparatorToKeys(key, separator);
      deep = true;
    }
    if (deep === true && (match = key.match(DEEP_QUERY_STRING_REG))) {
      parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform);
    } else {
      setQueryProperty(obj, key, val, auto, transform);
    }
  }

  function parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform) {
    var key = match[1];
    var inner = match[2].slice(1, -1).split('][');
    forEach(inner, function(k) {
      if (!hasOwn(obj, key)) {
        obj[key] = k ? {} : [];
      }
      obj = getOwn(obj, key);
      key = k ? k : obj.length.toString();
    });
    setQueryProperty(obj, key, val, auto, transform);
  }

  function mapQuerySeparatorToKeys(key, separator) {
    var split = key.split(separator), result = split[0];
    for (var i = 1, len = split.length; i < len; i++) {
      result += '[' + split[i] + ']';
    }
    return result;
  }

  function setQueryProperty(obj, key, val, auto, transform) {
    var fnValue;
    if (transform) {
      fnValue = transform(val, key, obj);
    }
    if (isDefined(fnValue)) {
      val = fnValue;
    } else if (auto) {
      val = getQueryValueAuto(obj, key, val);
    }
    obj[key] = val;
  }

  function getQueryValueAuto(obj, key, val) {
    if (!val) {
      return null;
    } else if (val === 'true') {
      return true;
    } else if (val === 'false') {
      return false;
    }
    var num = +val;
    if (!isNaN(num) && stringIsDecimal(val)) {
      return num;
    }
    var existing = getOwn(obj, key);
    if (val && existing) {
      return isArray(existing) ? existing.concat(val) : [existing, val];
    }
    return val;
  }

  function stringIsDecimal(str) {
    return str !== '' && !NON_DECIMAL_REG.test(str);
  }


  // Object Merging

  function mergeWithOptions(target, source, opts) {
    opts = opts || {};
    return objectMerge(target, source, opts.deep, opts.resolve, opts.hidden, opts.descriptor);
  }

  function defaults(target, sources, opts) {
    opts = opts || {};
    opts.resolve = opts.resolve || false;
    return mergeAll(target, sources, opts);
  }

  function mergeAll(target, sources, opts) {
    if (!isArray(sources)) {
      sources = [sources];
    }
    forEach(sources, function(source) {
      return mergeWithOptions(target, source, opts);
    });
    return target;
  }

  function iterateOverProperties(hidden, obj, fn) {
    if (getOwnPropertyNames && hidden) {
      iterateOverKeys(getOwnPropertyNames, obj, fn, hidden);
    } else {
      forEachProperty(obj, fn);
    }
    if (getOwnPropertySymbols) {
      iterateOverKeys(getOwnPropertySymbols, obj, fn, hidden);
    }
  }

  // "keys" may include symbols
  function iterateOverKeys(getFn, obj, fn, hidden) {
    var keys = getFn(obj), desc;
    for (var i = 0, key; key = keys[i]; i++) {
      desc = getOwnPropertyDescriptor(obj, key);
      if (desc.enumerable || hidden) {
        fn(obj[key], key);
      }
    }
  }

  function mergeByPropertyDescriptor(target, source, prop, sourceVal) {
    var descriptor = getOwnPropertyDescriptor(source, prop);
    if (isDefined(descriptor.value)) {
      descriptor.value = sourceVal;
    }
    defineProperty(target, prop, descriptor);
  }

  function objectMerge(target, source, deep, resolve, hidden, descriptor) {
    var resolveByFunction = isFunction(resolve), resolveConflicts = resolve !== false;

    if (isUndefined(target)) {
      target = getNewObjectForMerge(source);
    } else if (resolveConflicts && isDate(target) && isDate(source)) {
      // A date's timestamp is a property that can only be reached through its
      // methods, so actively set it up front if both are dates.
      target.setTime(source.getTime());
    }

    if (isPrimitive(target)) {
      // Will not merge into a primitive type, so simply override.
      return source;
    }

    // If the source object is a primitive
    // type then coerce it into an object.
    if (isPrimitive(source)) {
      source = coercePrimitiveToObject(source);
    }

    iterateOverProperties(hidden, source, function(val, key) {
      var sourceVal, targetVal, resolved, goDeep, result;

      sourceVal = source[key];

      // We are iterating over properties of the source, so hasOwnProperty on
      // it is guaranteed to always be true. However, the target may happen to
      // have properties in its prototype chain that should not be considered
      // as conflicts.
      targetVal = getOwn(target, key);

      if (resolveByFunction) {
        result = resolve(key, targetVal, sourceVal, target, source);
        if (isUndefined(result)) {
          // Result is undefined so do not merge this property.
          return;
        } else if (isDefined(result) && result !== Sugar) {
          // If the source returns anything except undefined, then the conflict
          // has been resolved, so don't continue traversing into the object. If
          // the returned value is the Sugar global object, then allowing Sugar
          // to resolve the conflict, so continue on.
          sourceVal = result;
          resolved = true;
        }
      } else if (isUndefined(sourceVal)) {
        // Will not merge undefined.
        return;
      }

      // Regex properties are read-only, so intentionally disallowing deep
      // merging for now. Instead merge by reference even if deep.
      goDeep = !resolved && deep && isObjectType(sourceVal) && !isRegExp(sourceVal);

      if (!goDeep && !resolveConflicts && isDefined(targetVal)) {
        return;
      }

      if (goDeep) {
        sourceVal = objectMerge(targetVal, sourceVal, deep, resolve, hidden, descriptor);
      }

      // getOwnPropertyNames is standing in as
      // a test for property descriptor support
      if (getOwnPropertyNames && descriptor) {
        mergeByPropertyDescriptor(target, source, key, sourceVal);
      } else {
        target[key] = sourceVal;
      }

    });
    return target;
  }

  function getNewObjectForMerge(source) {
    var klass = classToString(source);
    // Primitive types, dates, and regexes have no "empty" state. If they exist
    // at all, then they have an associated value. As we are only creating new
    // objects when they don't exist in the target, these values can come alone
    // for the ride when created.
    if (isArray(source, klass)) {
      return [];
    } else if (isPlainObject(source, klass)) {
      return {};
    } else if (isDate(source, klass)) {
      return new Date(source.getTime());
    } else if (isRegExp(source, klass)) {
      return RegExp(source.source, getRegExpFlags(source));
    } else if (isPrimitive(source && source.valueOf())) {
      return source;
    }
    // If the object is not of a known type, then simply merging its
    // properties into a plain object will result in something different
    // (it will not respond to instanceof operator etc). Similarly we don't
    // want to call a constructor here as we can't know for sure what the
    // original constructor was called with (Events etc), so throw an
    // error here instead. Non-standard types can be handled if either they
    // already exist and simply have their properties merged, if the merge
    // is not deep so their references will simply be copied over, or if a
    // resolve function is used to assist the merge.
    throw new TypeError('Must be a basic data type');
  }

  function clone(source, deep) {
    var target = getNewObjectForMerge(source);
    return objectMerge(target, source, deep, true, true, true);
  }


  // Keys/Values

  function objectSize(obj) {
    return getKeysWithObjectCoercion(obj).length;
  }

  function getKeysWithObjectCoercion(obj) {
    return getKeys(coercePrimitiveToObject(obj));
  }

  function getValues(obj) {
    var values = [];
    forEachProperty(obj, function(val) {
      values.push(val);
    });
    return values;
  }

  function tap(obj, arg) {
    var fn = arg;
    if (!isFunction(arg)) {
      fn = function() {
        if (arg) obj[arg]();
      };
    }
    fn.call(obj, obj);
    return obj;
  }

  // Select/Reject

  function objectSelect(obj, f) {
    return selectFromObject(obj, f, true);
  }

  function objectReject(obj, f) {
    return selectFromObject(obj, f, false);
  }

  function selectFromObject(obj, f, select) {
    var match, result = {};
    f = [].concat(f);
    forEachProperty(obj, function(val, key) {
      match = false;
      for (var i = 0; i < f.length; i++) {
        if (matchInObject(f[i], key)) {
          match = true;
        }
      }
      if (match === select) {
        result[key] = val;
      }
    });
    return result;
  }

  function matchInObject(match, key) {
    if (isRegExp(match)) {
      return match.test(key);
    } else if (isObjectType(match)) {
      return key in match;
    } else {
      return key === String(match);
    }
  }

  // Remove/Exclude

  function objectRemove(obj, f) {
    var matcher = getMatcher(f);
    forEachProperty(obj, function(val, key) {
      if (matcher(val, key, obj)) {
        delete obj[key];
      }
    });
    return obj;
  }

  function objectExclude(obj, f) {
    var result = {};
    var matcher = getMatcher(f);
    forEachProperty(obj, function(val, key) {
      if (!matcher(val, key, obj)) {
        result[key] = val;
      }
    });
    return result;
  }

  function objectIntersectOrSubtract(obj1, obj2, subtract) {
    if (!isObjectType(obj1)) {
      return subtract ? obj1 : {};
    }
    obj2 = coercePrimitiveToObject(obj2);
    function resolve(key, val, val1) {
      var exists = key in obj2 && isEqual(val1, obj2[key]);
      if (exists !== subtract) {
        return val1;
      }
    }
    return objectMerge({}, obj1, false, resolve);
  }

  
  function buildClassCheckMethods() {
    var checks = [isBoolean, isNumber, isString, isDate, isRegExp, isFunction, isArray, isError, isSet, isMap];
    defineInstanceAndStaticSimilar(sugarObject, NATIVE_TYPES, function(methods, name, i) {
      methods['is' + name] = checks[i];
    });
  }

  defineStatic(sugarObject, {

    
    'fromQueryString': function(obj, options) {
      return fromQueryStringWithOptions(obj, options);
    }

  });

  defineInstanceAndStatic(sugarObject, {

    
    'has': function(obj, key, any) {
      return deepHasProperty(obj, key, any);
    },

    
    'get': function(obj, key, any) {
      return deepGetProperty(obj, key, any);
    },

    
    'set': function(obj, key, val) {
      return deepSetProperty(obj, key, val);
    },

    
    'size': function(obj) {
      return objectSize(obj);
    },

    
    'isEmpty': function(obj) {
      return objectSize(obj) === 0;
    },

    
    'toQueryString': function(obj, options) {
      return toQueryStringWithOptions(obj, options);
    },

    
    'isEqual': function(obj1, obj2) {
      return isEqual(obj1, obj2);
    },

    
    'merge': function(target, source, opts) {
      return mergeWithOptions(target, source, opts);
    },

    
    'add': function(obj1, obj2, opts) {
      return mergeWithOptions(clone(obj1), obj2, opts);
    },

    
    'mergeAll': function(target, sources, opts) {
      return mergeAll(target, sources, opts);
    },

    
    'addAll': function(obj, sources, opts) {
      return mergeAll(clone(obj), sources, opts);
    },

    
    'defaults': function(target, sources, opts) {
      return defaults(target, sources, opts);
    },

    
    'intersect': function(obj1, obj2) {
      return objectIntersectOrSubtract(obj1, obj2, false);
    },

    
    'subtract': function(obj1, obj2) {
      return objectIntersectOrSubtract(obj1, obj2, true);
    },

    
    'clone': function(obj, deep) {
      return clone(obj, deep);
    },

    
    'values': function(obj) {
      return getValues(obj);
    },

    
    'invert': function(obj, multi) {
      var result = {};
      multi = multi === true;
      forEachProperty(obj, function(val, key) {
        if (hasOwn(result, val) && multi) {
          result[val].push(key);
        } else if (multi) {
          result[val] = [key];
        } else {
          result[val] = key;
        }
      });
      return result;
    },

    
    'tap': function(obj, arg) {
      return tap(obj, arg);
    },

    
    'isArguments': function(obj) {
      return isArguments(obj);
    },

    
    'isObject': function(obj) {
      return isPlainObject(obj);
    },

    
    'remove': function(obj, f) {
      return objectRemove(obj, f);
    },

    
    'exclude': function(obj, f) {
      return objectExclude(obj, f);
    },

    
    'select': function(obj, f) {
      return objectSelect(obj, f);
    },

    
    'reject': function(obj, f) {
      return objectReject(obj, f);
    }

  });

  // TODO: why is this here?
  defineInstance(sugarObject, {

    
    'keys': function(obj) {
      return getKeys(obj);
    }

  });

  buildClassCheckMethods();

  

  var DATE_OPTIONS = {
    'newDateInternal': defaultNewDate
  };

  var LOCALE_ARRAY_FIELDS = [
    'months', 'weekdays', 'units', 'numerals', 'placeholders',
    'articles', 'tokens', 'timeMarkers', 'ampm', 'timeSuffixes',
    'parse', 'timeParse', 'timeFrontParse', 'modifiers'
  ];

  // Regex for stripping Timezone Abbreviations
  var TIMEZONE_ABBREVIATION_REG = /\(([-+]\d{2,4}|\w{3,5})\)$/;

  // Regex for years with 2 digits or less
  var ABBREVIATED_YEAR_REG = /^'?(\d{1,2})$/;

  // One minute in milliseconds
  var MINUTES = 60 * 1000;

  // Date unit indexes
  var HOURS_INDEX   = 3,
      DAY_INDEX     = 4,
      WEEK_INDEX    = 5,
      MONTH_INDEX   = 6,
      YEAR_INDEX    = 7;

  // ISO Defaults
  var ISO_FIRST_DAY_OF_WEEK = 1,
      ISO_FIRST_DAY_OF_WEEK_YEAR = 4;

  var CoreParsingTokens = {
    'yyyy': {
      param: 'year',
      src: '[-−+]?\\d{4,6}'
    },
    'yy': {
      param: 'year',
      src: '\\d{2}'
    },
    'y': {
      param: 'year',
      src: '\\d'
    },
    'ayy': {
      param: 'year',
      src: '\'\\d{2}'
    },
    'MM': {
      param: 'month',
      src: '(?:1[012]|0?[1-9])'
    },
    'dd': {
      param: 'date',
      src: '(?:3[01]|[12][0-9]|0?[1-9])'
    },
    'hh': {
      param: 'hour',
      src: '(?:2[0-4]|[01]?[0-9])'
    },
    'mm': {
      param: 'minute',
      src: '[0-5]\\d'
    },
    'ss': {
      param: 'second',
      src: '[0-5]\\d(?:[,.]\\d+)?'
    },
    'tzHour': {
      src: '[-−+](?:2[0-4]|[01]?[0-9])'
    },
    'tzMinute': {
      src: '[0-5]\\d'
    },
    'iyyyy': {
      param: 'year',
      src: '(?:[-−+]?\\d{4}|[-−+]\\d{5,6})'
    },
    'ihh': {
      param: 'hour',
      src: '(?:2[0-4]|[01][0-9])(?:[,.]\\d+)?'
    },
    'imm': {
      param: 'minute',
      src: '[0-5]\\d(?:[,.]\\d+)?'
    },
    'GMT': {
      param: 'utc',
      src: 'GMT'
    },
    'Z': {
      param: 'utc',
      src: 'Z'
    },
    'timestamp': {
      src: '\\d+'
    }
  };

  var LocalizedParsingTokens = {
    'year': {
      base: 'yyyy|ayy',
      requiresSuffix: true
    },
    'month': {
      base: 'MM',
      requiresSuffix: true
    },
    'date': {
      base: 'dd',
      requiresSuffix: true
    },
    'hour': {
      base: 'hh',
      requiresSuffixOr: ':'
    },
    'minute': {
      base: 'mm'
    },
    'second': {
      base: 'ss'
    },
    'num': {
      src: '\\d+',
      requiresNumerals: true
    }
  };

  var CoreParsingFormats = [
    {
      // 12-1978
      // 08-1978 (MDY)
      src: '{MM}[-.\\/]{yyyy}'
    },
    {
      // 12/08/1978
      // 08/12/1978 (MDY)
      time: true,
      src: '{dd}[-\\/]{MM}(?:[-\\/]{yyyy|yy|y})?',
      mdy: '{MM}[-\\/]{dd}(?:[-\\/]{yyyy|yy|y})?'
    },
    {
      // 12.08.1978
      // 08.12.1978 (MDY)
      time: true,
      src: '{dd}\\.{MM}(?:\\.{yyyy|yy|y})?',
      mdy: '{MM}\\.{dd}(?:\\.{yyyy|yy|y})?',
      localeCheck: function(loc) {
        // Do not allow this format if the locale
        // uses a period as a time separator.
        return loc.timeSeparator !== '.';
      }
    },
    {
      // 1975-08-25
      time: true,
      src: '{yyyy}[-.\\/]{MM}(?:[-.\\/]{dd})?'
    },
    {
      // .NET JSON
      src: '\\\\/Date\\({timestamp}(?:[-+]\\d{4,4})?\\)\\\\/'
    },
    {
      // ISO-8601
      src: '{iyyyy}(?:-?{MM}(?:-?{dd}(?:T{ihh}(?::?{imm}(?::?{ss})?)?)?)?)?{tzOffset?}'
    }
  ];

  var CoreOutputFormats = {
    'ISO8601': '{yyyy}-{MM}-{dd}T{HH}:{mm}:{ss}.{SSS}{Z}',
    'RFC1123': '{Dow}, {dd} {Mon} {yyyy} {HH}:{mm}:{ss} {ZZ}',
    'RFC1036': '{Weekday}, {dd}-{Mon}-{yy} {HH}:{mm}:{ss} {ZZ}'
  };

  var FormatTokensBase = [
    {
      ldml: 'Dow',
      strf: 'a',
      lowerToken: 'dow',
      get: function(d, localeCode) {
        return localeManager.get(localeCode).getWeekdayName(getWeekday(d), 2);
      }
    },
    {
      ldml: 'Weekday',
      strf: 'A',
      lowerToken: 'weekday',
      allowAlternates: true,
      get: function(d, localeCode, alternate) {
        return localeManager.get(localeCode).getWeekdayName(getWeekday(d), alternate);
      }
    },
    {
      ldml: 'Mon',
      strf: 'b h',
      lowerToken: 'mon',
      get: function(d, localeCode) {
        return localeManager.get(localeCode).getMonthName(getMonth(d), 2);
      }
    },
    {
      ldml: 'Month',
      strf: 'B',
      lowerToken: 'month',
      allowAlternates: true,
      get: function(d, localeCode, alternate) {
        return localeManager.get(localeCode).getMonthName(getMonth(d), alternate);
      }
    },
    {
      strf: 'C',
      get: function(d) {
        return getYear(d).toString().slice(0, 2);
      }
    },
    {
      ldml: 'd date day',
      strf: 'd',
      strfPadding: 2,
      ldmlPaddedToken: 'dd',
      ordinalToken: 'do',
      get: function(d) {
        return getDate(d);
      }
    },
    {
      strf: 'e',
      get: function(d) {
        return padNumber(getDate(d), 2, false, 10, ' ');
      }
    },
    {
      ldml: 'H 24hr',
      strf: 'H',
      strfPadding: 2,
      ldmlPaddedToken: 'HH',
      get: function(d) {
        return getHours(d);
      }
    },
    {
      ldml: 'h hours 12hr',
      strf: 'I',
      strfPadding: 2,
      ldmlPaddedToken: 'hh',
      get: function(d) {
        return getHours(d) % 12 || 12;
      }
    },
    {
      ldml: 'D',
      strf: 'j',
      strfPadding: 3,
      ldmlPaddedToken: 'DDD',
      get: function(d) {
        var s = setUnitAndLowerToEdge(cloneDate(d), MONTH_INDEX);
        return getDaysSince(d, s) + 1;
      }
    },
    {
      ldml: 'M',
      strf: 'm',
      strfPadding: 2,
      ordinalToken: 'Mo',
      ldmlPaddedToken: 'MM',
      get: function(d) {
        return getMonth(d) + 1;
      }
    },
    {
      ldml: 'm minutes',
      strf: 'M',
      strfPadding: 2,
      ldmlPaddedToken: 'mm',
      get: function(d) {
        return callDateGet(d, 'Minutes');
      }
    },
    {
      ldml: 'Q',
      get: function(d) {
        return ceil((getMonth(d) + 1) / 3);
      }
    },
    {
      ldml: 'TT',
      strf: 'p',
      get: function(d, localeCode) {
        return getMeridiemToken(d, localeCode);
      }
    },
    {
      ldml: 'tt',
      strf: 'P',
      get: function(d, localeCode) {
        return getMeridiemToken(d, localeCode).toLowerCase();
      }
    },
    {
      ldml: 'T',
      lowerToken: 't',
      get: function(d, localeCode) {
        return getMeridiemToken(d, localeCode).charAt(0);
      }
    },
    {
      ldml: 's seconds',
      strf: 'S',
      strfPadding: 2,
      ldmlPaddedToken: 'ss',
      get: function(d) {
        return callDateGet(d, 'Seconds');
      }
    },
    {
      ldml: 'S ms',
      strfPadding: 3,
      ldmlPaddedToken: 'SSS',
      get: function(d) {
        return callDateGet(d, 'Milliseconds');
      }
    },
    {
      ldml: 'e',
      strf: 'u',
      ordinalToken: 'eo',
      get: function(d) {
        return getWeekday(d) || 7;
      }
    },
    {
      strf: 'U',
      strfPadding: 2,
      get: function(d) {
        // Sunday first, 0-53
        return getWeekNumber(d, false, 0);
      }
    },
    {
      ldml: 'W',
      strf: 'V',
      strfPadding: 2,
      ordinalToken: 'Wo',
      ldmlPaddedToken: 'WW',
      get: function(d) {
        // Monday first, 1-53 (ISO8601)
        return getWeekNumber(d, true);
      }
    },
    {
      strf: 'w',
      get: function(d) {
        return getWeekday(d);
      }
    },
    {
      ldml: 'w',
      ordinalToken: 'wo',
      ldmlPaddedToken: 'ww',
      get: function(d, localeCode) {
        // Locale dependent, 1-53
        var loc = localeManager.get(localeCode),
            dow = loc.getFirstDayOfWeek(localeCode),
            doy = loc.getFirstDayOfWeekYear(localeCode);
        return getWeekNumber(d, true, dow, doy);
      }
    },
    {
      strf: 'W',
      strfPadding: 2,
      get: function(d) {
        // Monday first, 0-53
        return getWeekNumber(d, false);
      }
    },
    {
      ldmlPaddedToken: 'gggg',
      ldmlTwoDigitToken: 'gg',
      get: function(d, localeCode) {
        return getWeekYear(d, localeCode);
      }
    },
    {
      strf: 'G',
      strfPadding: 4,
      strfTwoDigitToken: 'g',
      ldmlPaddedToken: 'GGGG',
      ldmlTwoDigitToken: 'GG',
      get: function(d, localeCode) {
        return getWeekYear(d, localeCode, true);
      }
    },
    {
      ldml: 'year',
      ldmlPaddedToken: 'yyyy',
      ldmlTwoDigitToken: 'yy',
      strf: 'Y',
      strfPadding: 4,
      strfTwoDigitToken: 'y',
      get: function(d) {
        return getYear(d);
      }
    },
    {
      ldml: 'ZZ',
      strf: 'z',
      get: function(d) {
        return getUTCOffset(d);
      }
    },
    {
      ldml: 'X',
      get: function(d) {
        return trunc(d.getTime() / 1000);
      }
    },
    {
      ldml: 'x',
      get: function(d) {
        return d.getTime();
      }
    },
    {
      ldml: 'Z',
      get: function(d) {
        return getUTCOffset(d, true);
      }
    },
    {
      ldml: 'z',
      strf: 'Z',
      get: function(d) {
        // Note that this is not accurate in all browsing environments!
        // https://github.com/moment/moment/issues/162
        // It will continue to be supported for Node and usage with the
        // understanding that it may be blank.
        var match = d.toString().match(TIMEZONE_ABBREVIATION_REG);
        // istanbul ignore next
        return match ? match[1] : '';
      }
    },
    {
      strf: 'D',
      alias: '%m/%d/%y'
    },
    {
      strf: 'F',
      alias: '%Y-%m-%d'
    },
    {
      strf: 'r',
      alias: '%I:%M:%S %p'
    },
    {
      strf: 'R',
      alias: '%H:%M'
    },
    {
      strf: 'T',
      alias: '%H:%M:%S'
    },
    {
      strf: 'x',
      alias: '{short}'
    },
    {
      strf: 'X',
      alias: '{time}'
    },
    {
      strf: 'c',
      alias: '{stamp}'
    }
  ];

  var DateUnits = [
    {
      name: 'millisecond',
      method: 'Milliseconds',
      multiplier: 1,
      start: 0,
      end: 999
    },
    {
      name: 'second',
      method: 'Seconds',
      multiplier: 1000,
      start: 0,
      end: 59
    },
    {
      name: 'minute',
      method: 'Minutes',
      multiplier: 60 * 1000,
      start: 0,
      end: 59
    },
    {
      name: 'hour',
      method: 'Hours',
      multiplier: 60 * 60 * 1000,
      start: 0,
      end: 23
    },
    {
      name: 'day',
      alias: 'date',
      method: 'Date',
      ambiguous: true,
      multiplier: 24 * 60 * 60 * 1000,
      start: 1,
      end: function(d) {
        return getDaysInMonth(d);
      }
    },
    {
      name: 'week',
      method: 'ISOWeek',
      ambiguous: true,
      multiplier: 7 * 24 * 60 * 60 * 1000
    },
    {
      name: 'month',
      method: 'Month',
      ambiguous: true,
      multiplier: 30.4375 * 24 * 60 * 60 * 1000,
      start: 0,
      end: 11
    },
    {
      name: 'year',
      method: 'FullYear',
      ambiguous: true,
      multiplier: 365.25 * 24 * 60 * 60 * 1000,
      start: 0
    }
  ];

  
  var _dateOptions = defineOptionsAccessor(sugarDate, DATE_OPTIONS);

  function setDateChainableConstructor() {
    setChainableConstructor(sugarDate, createDate);
  }

  // General helpers

  function getNewDate() {
    return _dateOptions('newDateInternal')();
  }

  function defaultNewDate() {
    return new Date;
  }

  function cloneDate(d) {
    // Rhino environments have a bug where new Date(d) truncates
    // milliseconds so need to call getTime() here.
    var clone = new Date(d.getTime());
    _utc(clone, !!_utc(d));
    return clone;
  }

  function dateIsValid(d) {
    return !isNaN(d.getTime());
  }

  function assertDateIsValid(d) {
    if (!dateIsValid(d)) {
      throw new TypeError('Date is not valid');
    }
  }

  function getHours(d) {
    return callDateGet(d, 'Hours');
  }

  function getWeekday(d) {
    return callDateGet(d, 'Day');
  }

  function getDate(d) {
    return callDateGet(d, 'Date');
  }

  function getMonth(d) {
    return callDateGet(d, 'Month');
  }

  function getYear(d) {
    return callDateGet(d, 'FullYear');
  }

  function setDate(d, val) {
    callDateSet(d, 'Date', val);
  }

  function setMonth(d, val) {
    callDateSet(d, 'Month', val);
  }

  function setYear(d, val) {
    callDateSet(d, 'FullYear', val);
  }

  function getDaysInMonth(d) {
    return 32 - callDateGet(new Date(getYear(d), getMonth(d), 32), 'Date');
  }

  function setWeekday(d, dow, dir) {
    if (!isNumber(dow)) return;
    var currentWeekday = getWeekday(d);
    if (dir) {
      // Allow a "direction" parameter to determine whether a weekday can
      // be set beyond the current weekday in either direction.
      var ndir = dir > 0 ? 1 : -1;
      var offset = dow % 7 - currentWeekday;
      if (offset && offset / abs(offset) !== ndir) {
        dow += 7 * ndir;
      }
    }
    setDate(d, getDate(d) + dow - currentWeekday);
    return d.getTime();
  }

  // Normal callDateSet method with ability
  // to handle ISOWeek setting as well.
  function callDateSetWithWeek(d, method, value, safe) {
    if (method === 'ISOWeek') {
      setISOWeekNumber(d, value);
    } else {
      callDateSet(d, method, value, safe);
    }
  }

  // UTC helpers

  function isUTC(d) {
    return !!_utc(d) || tzOffset(d) === 0;
  }

  function getUTCOffset(d, iso) {
    var offset = _utc(d) ? 0 : tzOffset(d), hours, mins, colon;
    colon  = iso === true ? ':' : '';
    if (!offset && iso) return 'Z';
    hours = padNumber(trunc(-offset / 60), 2, true);
    mins = padNumber(abs(offset % 60), 2);
    return  hours + colon + mins;
  }

  function tzOffset(d) {
    return d.getTimezoneOffset();
  }

  // Argument helpers

  function collectUpdateDateArguments(args, allowDuration) {
    var arg1 = args[0], arg2 = args[1], params, reset;
    if (allowDuration && isString(arg1)) {
      params = getDateParamsFromString(arg1);
      reset  = arg2;
    } else if (isNumber(arg1) && isNumber(arg2)) {
      params = collectDateParamsFromArguments(args);
    } else {
      params = isObjectType(arg1) ? simpleClone(arg1) : arg1;
      reset  = arg2;
    }
    return [params, reset];
  }

  function collectDateParamsFromArguments(args) {
    var params = {}, index = 0;
    walkUnitDown(YEAR_INDEX, function(unit) {
      var arg = args[index++];
      if (isDefined(arg)) {
        params[unit.name] = arg;
      }
    });
    return params;
  }

  function getDateParamsFromString(str) {
    var match, num, params = {};
    match = str.match(/^(-?\d*[\d.]\d*)?\s?(\w+?)s?$/i);
    if (match) {
      if (isUndefined(num)) {
        num = match[1] ? +match[1] : 1;
      }
      params[match[2].toLowerCase()] = num;
    }
    return params;
  }

  // Iteration helpers

  // Years -> Milliseconds
  function iterateOverDateUnits(fn, startIndex, endIndex) {
    endIndex = endIndex || 0;
    if (isUndefined(startIndex)) {
      startIndex = YEAR_INDEX;
    }
    for (var index = startIndex; index >= endIndex; index--) {
      if (fn(DateUnits[index], index) === false) {
        break;
      }
    }
  }

  // Years -> Milliseconds using getLower/Higher methods
  function walkUnitDown(unitIndex, fn) {
    while (unitIndex >= 0) {
      if (fn(DateUnits[unitIndex], unitIndex) === false) {
        break;
      }
      unitIndex = getLowerUnitIndex(unitIndex);
    }
  }

  // Moving lower from specific unit
  function getLowerUnitIndex(index) {
    if (index === MONTH_INDEX) {
      return DAY_INDEX;
    } else if (index === WEEK_INDEX) {
      return HOURS_INDEX;
    }
    return index - 1;
  }

  // Moving higher from specific unit
  function getHigherUnitIndex(index) {
    return index === DAY_INDEX ? MONTH_INDEX : index + 1;
  }

  // Years -> Milliseconds checking all date params including "weekday"
  function iterateOverDateParams(params, fn, startIndex, endIndex) {

    function run(name, unit, i) {
      var val = getDateParam(params, name);
      if (isDefined(val)) {
        fn(name, val, unit, i);
      }
    }

    iterateOverDateUnits(function (unit, i) {
      var result = run(unit.name, unit, i);
      if (result !== false && i === DAY_INDEX) {
        // Check for "weekday", which has a distinct meaning
        // in the context of setting a date, but has the same
        // meaning as "day" as a unit of time.
        result = run('weekday', unit, i);
      }
      return result;
    }, startIndex, endIndex);

  }

  // Years -> Days
  function iterateOverHigherDateParams(params, fn) {
    iterateOverDateParams(params, fn, YEAR_INDEX, DAY_INDEX);
  }

  // Advancing helpers

  function advanceDate(d, unit, num, reset) {
    var set = {};
    set[unit] = num;
    return updateDate(d, set, reset, 1);
  }

  function advanceDateWithArgs(d, args, dir) {
    args = collectUpdateDateArguments(args, true);
    return updateDate(d, args[0], args[1], dir);
  }

  // Edge helpers

  function resetTime(d) {
    return setUnitAndLowerToEdge(d, HOURS_INDEX);
  }

  function resetLowerUnits(d, unitIndex) {
    return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
  }

  function moveToBeginningOfWeek(d, firstDayOfWeek) {
    setWeekday(d, floor((getWeekday(d) - firstDayOfWeek) / 7) * 7 + firstDayOfWeek);
    return d;
  }

  function moveToEndOfWeek(d, firstDayOfWeek) {
    var target = firstDayOfWeek - 1;
    setWeekday(d, ceil((getWeekday(d) - target) / 7) * 7 + target);
    return d;
  }

  function moveToBeginningOfUnit(d, unitIndex, localeCode) {
    if (unitIndex === WEEK_INDEX) {
      moveToBeginningOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
    }
    return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
  }

  function moveToEndOfUnit(d, unitIndex, localeCode, stopIndex) {
    if (unitIndex === WEEK_INDEX) {
      moveToEndOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
    }
    return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex), stopIndex, true);
  }

  function setUnitAndLowerToEdge(d, startIndex, stopIndex, end) {
    walkUnitDown(startIndex, function(unit, i) {
      var val = end ? unit.end : unit.start;
      if (isFunction(val)) {
        val = val(d);
      }
      callDateSet(d, unit.method, val);
      return !isDefined(stopIndex) || i > stopIndex;
    });
    return d;
  }

  // Param helpers

  function getDateParamKey(params, key) {
    return getOwnKey(params, key) ||
           getOwnKey(params, key + 's') ||
           (key === 'day' && getOwnKey(params, 'date'));
  }

  function getDateParam(params, key) {
    return getOwn(params, getDateParamKey(params, key));
  }

  function deleteDateParam(params, key) {
    delete params[getDateParamKey(params, key)];
  }

  function getUnitIndexForParamName(name) {
    var params = {}, unitIndex;
    params[name] = 1;
    iterateOverDateParams(params, function(name, val, unit, i) {
      unitIndex = i;
      return false;
    });
    return unitIndex;
  }

  // Time distance helpers

  function getDaysSince(d1, d2) {
    return getTimeDistanceForUnit(d1, d2, DateUnits[DAY_INDEX]);
  }

  function getTimeDistanceForUnit(d1, d2, unit) {
    var fwd = d2 > d1, num, tmp;
    if (!fwd) {
      tmp = d2;
      d2  = d1;
      d1  = tmp;
    }
    num = d2 - d1;
    if (unit.multiplier > 1) {
      num = trunc(num / unit.multiplier);
    }
    // For higher order with potential ambiguity, use the numeric calculation
    // as a starting point, then iterate until we pass the target date. Decrement
    // starting point by 1 to prevent overshooting the date due to inconsistencies
    // in ambiguous units numerically. For example, calculating the number of days
    // from the beginning of the year to August 5th at 11:59:59 by doing a simple
    // d2 - d1 will produce different results depending on whether or not a
    // timezone shift was encountered due to DST, however that should not have an
    // effect on our calculation here, so subtract by 1 to ensure that the
    // starting point has not already overshot our target date.
    if (unit.ambiguous) {
      d1 = cloneDate(d1);
      if (num) {
        num -= 1;
        advanceDate(d1, unit.name, num);
      }
      while (d1 < d2) {
        advanceDate(d1, unit.name, 1);
        if (d1 > d2) {
          break;
        }
        num += 1;
      }
    }
    return fwd ? -num : num;
  }

  // Parsing helpers

  function getYearFromAbbreviation(str, d, prefer) {
    // Following IETF here, adding 1900 or 2000 depending on the last two digits.
    // Note that this makes no accordance for what should happen after 2050, but
    // intentionally ignoring this for now. https://www.ietf.org/rfc/rfc2822.txt
    var val = +str, delta;
    val += val < 50 ? 2000 : 1900;
    if (prefer) {
      delta = val - getYear(d);
      if (delta / abs(delta) !== prefer) {
        val += prefer * 100;
      }
    }
    return val;
  }

  // Week number helpers

  function setISOWeekNumber(d, num) {
    if (isNumber(num)) {
      // Intentionally avoiding updateDate here to prevent circular dependencies.
      var isoWeek = cloneDate(d), dow = getWeekday(d);
      moveToFirstDayOfWeekYear(isoWeek, ISO_FIRST_DAY_OF_WEEK, ISO_FIRST_DAY_OF_WEEK_YEAR);
      setDate(isoWeek, getDate(isoWeek) + 7 * (num - 1));
      setYear(d, getYear(isoWeek));
      setMonth(d, getMonth(isoWeek));
      setDate(d, getDate(isoWeek));
      setWeekday(d, dow || 7);
    }
    return d.getTime();
  }

  function getWeekNumber(d, allowPrevious, firstDayOfWeek, firstDayOfWeekYear) {
    var isoWeek, n = 0;
    if (isUndefined(firstDayOfWeek)) {
      firstDayOfWeek = ISO_FIRST_DAY_OF_WEEK;
    }
    if (isUndefined(firstDayOfWeekYear)) {
      firstDayOfWeekYear = ISO_FIRST_DAY_OF_WEEK_YEAR;
    }
    // Moving to the end of the week allows for forward year traversal, ie
    // Dec 29 2014 is actually week 01 of 2015.
    isoWeek = moveToEndOfWeek(cloneDate(d), firstDayOfWeek);
    moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
    if (allowPrevious && d < isoWeek) {
      // If the date is still before the start of the year, then it should be
      // the last week of the previous year, ie Jan 1 2016 is actually week 53
      // of 2015, so move to the beginning of the week to traverse the year.
      isoWeek = moveToBeginningOfWeek(cloneDate(d), firstDayOfWeek);
      moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
    }
    while (isoWeek <= d) {
      // Doing a very simple walk to get the week number.
      setDate(isoWeek, getDate(isoWeek) + 7);
      n++;
    }
    return n;
  }

  // Week year helpers

  function getWeekYear(d, localeCode, iso) {
    var year, month, firstDayOfWeek, firstDayOfWeekYear, week, loc;
    year = getYear(d);
    month = getMonth(d);
    if (month === 0 || month === 11) {
      if (!iso) {
        loc = localeManager.get(localeCode);
        firstDayOfWeek = loc.getFirstDayOfWeek(localeCode);
        firstDayOfWeekYear = loc.getFirstDayOfWeekYear(localeCode);
      }
      week = getWeekNumber(d, false, firstDayOfWeek, firstDayOfWeekYear);
      if (month === 0 && week === 0) {
        year -= 1;
      } else if (month === 11 && week === 1) {
        year += 1;
      }
    }
    return year;
  }

  function moveToFirstDayOfWeekYear(d, firstDayOfWeek, firstDayOfWeekYear) {
    setUnitAndLowerToEdge(d, MONTH_INDEX);
    setDate(d, firstDayOfWeekYear);
    moveToBeginningOfWeek(d, firstDayOfWeek);
  }

  // Relative helpers

  function dateRelative(d, dRelative, arg1, arg2) {
    var adu, format, type, localeCode, fn;
    assertDateIsValid(d);
    if (isFunction(arg1)) {
      fn = arg1;
    } else {
      localeCode = arg1;
      fn = arg2;
    }
    adu = getAdjustedUnitForDate(d, dRelative);
    if (fn) {
      format = fn.apply(d, adu.concat(localeManager.get(localeCode)));
      if (format) {
        return dateFormat(d, format, localeCode);
      }
    }
    // Adjust up if time is in ms, as this doesn't
    // look very good for a standard relative date.
    if (adu[1] === 0) {
      adu[1] = 1;
      adu[0] = 1;
    }
    if (dRelative) {
      type = 'duration';
    } else if (adu[2] > 0) {
      type = 'future';
    } else {
      type = 'past';
    }
    return localeManager.get(localeCode).getRelativeFormat(adu, type);
  }

  // Gets an "adjusted date unit" which is a way of representing
  // the largest possible meaningful unit. In other words, if passed
  // 3600000, this will return an array which represents "1 hour".
  function getAdjustedUnit(ms, fn) {
    var unitIndex = 0, value = 0;
    iterateOverDateUnits(function(unit, i) {
      value = abs(fn(unit));
      if (value >= 1) {
        unitIndex = i;
        return false;
      }
    });
    return [value, unitIndex, ms];
  }

  // Gets the adjusted unit based on simple division by
  // date unit multiplier.
  function getAdjustedUnitForNumber(ms) {
    return getAdjustedUnit(ms, function(unit) {
      return trunc(withPrecision(ms / unit.multiplier, 1));
    });
  }

  // Gets the adjusted unit using the unitsFromNow methods,
  // which use internal date methods that neatly avoid vaguely
  // defined units of time (days in month, leap years, etc).
  // Reserving dRelative to allow another date to be relative to.
  function getAdjustedUnitForDate(d, dRelative) {
    var ms;
    if (!dRelative) {
      dRelative = getNewDate();
      if (d > dRelative) {
        // If our date is greater than the one that we got from getNewDate, it
        // means that we are finding the unit for a date that is in the future
        // relative to now. However, often the incoming date was created in
        // the same cycle as our comparison, but our "now" date will have been
        // created an instant after it, creating situations where "5 minutes from
        // now" becomes "4 minutes from now" in the same tick. To prevent this,
        // subtract a buffer of 10ms to compensate.
        dRelative = new Date(dRelative.getTime() - 10);
      }
    }
    ms = d - dRelative;
    return getAdjustedUnit(ms, function(u) {
      return abs(getTimeDistanceForUnit(d, dRelative, u));
    });
  }

  // Foramtting helpers

  // Formatting tokens
  var ldmlTokens, strfTokens;

  function dateFormat(d, format, localeCode) {
    assertDateIsValid(d);
    format = CoreOutputFormats[format] || format || '{long}';
    return dateFormatMatcher(format, d, localeCode);
  }

  function getMeridiemToken(d, localeCode) {
    var hours = getHours(d);
    return localeManager.get(localeCode).ampm[trunc(hours / 12)] || '';
  }

  function buildDateFormatTokens() {

    function addFormats(target, tokens, fn) {
      if (tokens) {
        forEach(spaceSplit(tokens), function(token) {
          target[token] = fn;
        });
      }
    }

    function buildLowercase(get) {
      return function(d, localeCode) {
        return get(d, localeCode).toLowerCase();
      };
    }

    function buildOrdinal(get) {
      return function(d, localeCode) {
        var n = get(d, localeCode);
        return n + localeManager.get(localeCode).getOrdinal(n);
      };
    }

    function buildPadded(get, padding) {
      return function(d, localeCode) {
        return padNumber(get(d, localeCode), padding);
      };
    }

    function buildTwoDigits(get) {
      return function(d, localeCode) {
        return get(d, localeCode) % 100;
      };
    }

    function buildAlias(alias) {
      return function(d, localeCode) {
        return dateFormatMatcher(alias, d, localeCode);
      };
    }

    function buildAlternates(f) {
      for (var n = 1; n <= 5; n++) {
        buildAlternate(f, n);
      }
    }

    function buildAlternate(f, n) {
      var alternate = function(d, localeCode) {
        return f.get(d, localeCode, n);
      };
      addFormats(ldmlTokens, f.ldml + n, alternate);
      if (f.lowerToken) {
        ldmlTokens[f.lowerToken + n] = buildLowercase(alternate);
      }
    }

    function getIdentityFormat(name) {
      return function(d, localeCode) {
        var loc = localeManager.get(localeCode);
        return dateFormatMatcher(loc[name], d, localeCode);
      };
    }

    ldmlTokens = {};
    strfTokens = {};

    forEach(FormatTokensBase, function(f) {
      var get = f.get, getPadded;
      if (f.lowerToken) {
        ldmlTokens[f.lowerToken] = buildLowercase(get);
      }
      if (f.ordinalToken) {
        ldmlTokens[f.ordinalToken] = buildOrdinal(get, f);
      }
      if (f.ldmlPaddedToken) {
        ldmlTokens[f.ldmlPaddedToken] = buildPadded(get, f.ldmlPaddedToken.length);
      }
      if (f.ldmlTwoDigitToken) {
        ldmlTokens[f.ldmlTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
      }
      if (f.strfTwoDigitToken) {
        strfTokens[f.strfTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
      }
      if (f.strfPadding) {
        getPadded = buildPadded(get, f.strfPadding);
      }
      if (f.alias) {
        get = buildAlias(f.alias);
      }
      if (f.allowAlternates) {
        buildAlternates(f);
      }
      addFormats(ldmlTokens, f.ldml, get);
      addFormats(strfTokens, f.strf, getPadded || get);
    });

    forEachProperty(CoreOutputFormats, function(src, name) {
      addFormats(ldmlTokens, name, buildAlias(src));
    });

    defineInstanceSimilar(sugarDate, 'short medium long full', function(methods, name) {
      var fn = getIdentityFormat(name);
      addFormats(ldmlTokens, name, fn);
      methods[name] = fn;
    });

    addFormats(ldmlTokens, 'time', getIdentityFormat('time'));
    addFormats(ldmlTokens, 'stamp', getIdentityFormat('stamp'));
  }

  // Format matcher

  var dateFormatMatcher;

  function buildDateFormatMatcher() {

    function getLdml(d, token, localeCode) {
      return getOwn(ldmlTokens, token)(d, localeCode);
    }

    function getStrf(d, token, localeCode) {
      return getOwn(strfTokens, token)(d, localeCode);
    }

    function checkDateToken(ldml, strf) {
      return hasOwn(ldmlTokens, ldml) || hasOwn(strfTokens, strf);
    }

    // Format matcher for LDML or STRF tokens.
    dateFormatMatcher = createFormatMatcher(getLdml, getStrf, checkDateToken);
  }

  // Comparison helpers

  function fullCompareDate(date, d, margin) {
    var tmp;
    if (!dateIsValid(date)) return;
    if (isString(d)) {
      d = trim(d).toLowerCase();
      switch(true) {
        case d === 'future':    return date.getTime() > getNewDate().getTime();
        case d === 'past':      return date.getTime() < getNewDate().getTime();
        case d === 'today':     return compareDay(date);
        case d === 'tomorrow':  return compareDay(date,  1);
        case d === 'yesterday': return compareDay(date, -1);
        case d === 'weekday':   return getWeekday(date) > 0 && getWeekday(date) < 6;
        case d === 'weekend':   return getWeekday(date) === 0 || getWeekday(date) === 6;

        case (isDefined(tmp = English.weekdayMap[d])):
          return getWeekday(date) === tmp;
        case (isDefined(tmp = English.monthMap[d])):
          return getMonth(date) === tmp;
      }
    }
    return compareDate(date, d, margin);
  }

  function compareDate(date, d, margin, localeCode, options) {
    var loMargin = 0, hiMargin = 0, timezoneShift, compareEdges, override, min, max, p, t;

    function getTimezoneShift() {
      // If there is any specificity in the date then we're implicitly not
      // checking absolute time, so ignore timezone shifts.
      if (p.set && p.set.specificity) {
        return 0;
      }
      return (tzOffset(p.date) - tzOffset(date)) * MINUTES;
    }

    function addSpecificUnit() {
      var unit = DateUnits[p.set.specificity];
      return advanceDate(cloneDate(p.date), unit.name, 1).getTime() - 1;
    }

    if (_utc(date)) {
      options = options || {};
      options.fromUTC = true;
      options.setUTC = true;
    }

    p = getExtendedDate(null, d, options, true);

    if (margin > 0) {
      loMargin = hiMargin = margin;
      override = true;
    }
    if (!dateIsValid(p.date)) return false;
    if (p.set && p.set.specificity) {
      if (isDefined(p.set.edge) || isDefined(p.set.shift)) {
        compareEdges = true;
        moveToBeginningOfUnit(p.date, p.set.specificity, localeCode);
      }
      if (compareEdges || p.set.specificity === MONTH_INDEX) {
        max = moveToEndOfUnit(cloneDate(p.date), p.set.specificity, localeCode).getTime();
      } else {
        max = addSpecificUnit();
      }
      if (!override && isDefined(p.set.sign) && p.set.specificity) {
        // If the time is relative, there can occasionally be an disparity between
        // the relative date and "now", which it is being compared to, so set an
        // extra margin to account for this.
        loMargin = 50;
        hiMargin = -50;
      }
    }
    t   = date.getTime();
    min = p.date.getTime();
    max = max || min;
    timezoneShift = getTimezoneShift();
    // istanbul ignore if
    if (timezoneShift) {
      min -= timezoneShift;
      max -= timezoneShift;
    }
    return t >= (min - loMargin) && t <= (max + hiMargin);
  }

  function compareDay(d, shift) {
    var comp = getNewDate();
    if (shift) {
      setDate(comp, getDate(comp) + shift);
    }
    return getYear(d) === getYear(comp) &&
           getMonth(d) === getMonth(comp) &&
           getDate(d) === getDate(comp);
  }

  // Create helpers

  function createDate(d, options, forceClone) {
    return getExtendedDate(null, d, options, forceClone).date;
  }

  function createDateWithContext(contextDate, d, options, forceClone) {
    return getExtendedDate(contextDate, d, options, forceClone).date;
  }

  function getExtendedDate(contextDate, d, opt, forceClone) {

    // Locals
    var date, set, loc, afterCallbacks, relative, weekdayDir;

    // Options
    var optPrefer, optLocale, optFromUTC, optSetUTC, optParams, optClone;

    afterCallbacks = [];

    setupOptions(opt);

    function setupOptions(opt) {
      opt = isString(opt) ? { locale: opt } : opt || {};
      optPrefer  = +!!getOwn(opt, 'future') - +!!getOwn(opt, 'past');
      optLocale  = getOwn(opt, 'locale');
      optFromUTC = getOwn(opt, 'fromUTC');
      optSetUTC  = getOwn(opt, 'setUTC');
      optParams  = getOwn(opt, 'params');
      optClone   = getOwn(opt, 'clone');
    }

    function parseFormatValues(match, dif) {
      var set = optParams || {};
      forEach(dif.to, function(param, i) {
        var str = match[i + 1], val;
        if (!str) return;

        val = parseIrregular(str, param);

        if (isUndefined(val)) {
          val = loc.parseValue(str, param);
        }

        set[param] = val;
      });
      return set;
    }

    function parseIrregular(str, param) {
      if (param === 'utc') {
        return 1;
      } else if (param === 'year') {
        var match = str.match(ABBREVIATED_YEAR_REG);
        if (match) {
          return getYearFromAbbreviation(match[1], date, optPrefer);
        }
      }
    }

    // Force the UTC flags to be true if the source date
    // date is UTC, as they will be overwritten later.
    function cloneDateByFlag(d, clone) {
      if (_utc(d) && !isDefined(optFromUTC)) {
        optFromUTC = true;
      }
      if (_utc(d) && !isDefined(optSetUTC)) {
        optSetUTC = true;
      }
      if (clone) {
        d = new Date(d.getTime());
      }
      return d;
    }

    function afterDateSet(fn) {
      afterCallbacks.push(fn);
    }

    function fireCallbacks() {
      forEach(afterCallbacks, function(fn) {
        fn.call();
      });
    }

    function parseStringDate(str) {

      str = str.toLowerCase();

      // The act of getting the locale will initialize
      // if it is missing and add the required formats.
      loc = localeManager.get(optLocale);

      for (var i = 0, dif, match; dif = loc.compiledFormats[i]; i++) {
        match = str.match(dif.reg);
        if (match) {

          // Note that caching the format will modify the compiledFormats array
          // which is not a good idea to do inside its for loop, however we
          // know at this point that we have a matched format and that we will
          // break out below, so simpler to do it here.
          loc.cacheFormat(dif, i);

          set = parseFormatValues(match, dif);

          if (isDefined(set.timestamp)) {
            date.setTime(set.timestamp);
            break;
          }

          if (isDefined(set.ampm)) {
            handleAmpm(set.ampm);
          }

          if (isDefined(set.hour) || isDefined(set.hours)) {
            privatePropertyAccessor('timeParsed')(date, true);
          }

          if (set.utc || isDefined(set.tzHour)) {
            handleTimezoneOffset(set.tzHour, set.tzMinute);
          }

          if (isDefined(set.shift) && isUndefined(set.unit)) {
            // "next january", "next monday", etc
            handleUnitlessShift();
          }

          if (isDefined(set.num) && isUndefined(set.unit)) {
            // "the second of January", etc
            handleUnitlessNum(set.num);
          }

          if (set.midday) {
            // "noon" and "midnight"
            handleMidday(set.midday);
          }

          if (isDefined(set.day)) {
            // Relative day localizations such as "today" and "tomorrow".
            handleRelativeDay(set.day);
          }

          if (isDefined(set.unit)) {
            // "3 days ago", etc
            handleRelativeUnit(set.unit);
          }

          if (set.edge) {
            // "the end of January", etc
            handleEdge(set.edge, set);
          }

          break;
        }
      }

      if (!set) {
        // TODO: remove in next major version
        // Fall back to native parsing
        date = new Date(str);
        if (optFromUTC && dateIsValid(date)) {
          // Falling back to system date here which cannot be parsed as UTC,
          // so if we're forcing UTC then simply add the offset.
          date.setTime(date.getTime() + (tzOffset(date) * MINUTES));
        }
      } else if (relative) {
        updateDate(date, set, false, 1);
      } else {
        updateDate(date, set, true, 0, optPrefer, weekdayDir, contextDate);
      }
      fireCallbacks();
      return date;
    }

    function handleAmpm(ampm) {
      if (ampm === 1 && set.hour < 12) {
        // If the time is 1pm-11pm advance the time by 12 hours.
        set.hour += 12;
      } else if (ampm === 0 && set.hour === 12) {
        // If it is 12:00am then set the hour to 0.
        set.hour = 0;
      }
    }

    function handleTimezoneOffset(tzHour, tzMinute) {
      // Adjust for timezone offset
      _utc(date, true);

      // Sign is parsed as part of the hour, so flip
      // the minutes if it's negative.

      if (tzHour < 0) {
        tzMinute *= -1;
      }

      var offset = tzHour * 60 + (tzMinute || 0);
      if (offset) {
        set.minute = (set.minute || 0) - offset;
      }
    }

    function handleUnitlessShift() {
      if (isDefined(set.month)) {
        // "next January"
        set.unit = YEAR_INDEX;
      } else if (isDefined(set.weekday)) {
        // "next Monday"
        set.unit = WEEK_INDEX;
      }
    }

    function handleUnitlessNum(num) {
      if (isDefined(set.weekday)) {
        // "The second Tuesday of March"
        setOrdinalWeekday(num);
      } else if (isDefined(set.month)) {
        // "The second of March"
        set.date = set.num;
      }
    }

    function handleMidday(hour) {
      set.hour = hour % 24;
      if (hour > 23) {
        // If the date has hours past 24, we need to prevent it from traversing
        // into a new day as that would make it being part of a new week in
        // ambiguous dates such as "Monday".
        afterDateSet(function() {
          advanceDate(date, 'date', trunc(hour / 24));
        });
      }
    }

    function handleRelativeDay() {
      resetTime(date);
      if (isUndefined(set.unit)) {
        set.unit = DAY_INDEX;
        set.num  = set.day;
        delete set.day;
      }
    }

    function handleRelativeUnit(unitIndex) {
      var num;

      if (isDefined(set.num)) {
        num = set.num;
      } else if (isDefined(set.edge) && isUndefined(set.shift)) {
        num = 0;
      } else {
        num = 1;
      }

      // If a weekday is defined, there are 3 possible formats being applied:
      //
      // 1. "the day after monday": unit is days
      // 2. "next monday": short for "next week monday", unit is weeks
      // 3. "the 2nd monday of next month": unit is months
      //
      // In the first case, we need to set the weekday up front, as the day is
      // relative to it. The second case also needs to be handled up front for
      // formats like "next monday at midnight" which will have its weekday reset
      // if not set up front. The last case will set up the params necessary to
      // shift the weekday and allow separateAbsoluteUnits below to handle setting
      // it after the date has been shifted.
      if(isDefined(set.weekday)) {
        if(unitIndex === MONTH_INDEX) {
          setOrdinalWeekday(num);
          num = 1;
        } else {
          updateDate(date, { weekday: set.weekday }, true);
          delete set.weekday;
        }
      }

      if (set.half) {
        // Allow localized "half" as a standalone colloquialism. Purposely avoiding
        // the locale number system to reduce complexity. The units "month" and
        // "week" are purposely excluded in the English date formats below, as
        // "half a week" and "half a month" are meaningless as exact dates.
        num *= set.half;
      }

      if (isDefined(set.shift)) {
        // Shift and unit, ie "next month", "last week", etc.
        num *= set.shift;
      } else if (set.sign) {
        // Unit and sign, ie "months ago", "weeks from now", etc.
        num *= set.sign;
      }

      if (isDefined(set.day)) {
        // "the day after tomorrow"
        num += set.day;
        delete set.day;
      }

      // Formats like "the 15th of last month" or "6:30pm of next week"
      // contain absolute units in addition to relative ones, so separate
      // them here, remove them from the params, and set up a callback to
      // set them after the relative ones have been set.
      separateAbsoluteUnits(unitIndex);

      // Finally shift the unit.
      set[English.units[unitIndex]] = num;
      relative = true;
    }

    function handleEdge(edge, params) {
      var edgeIndex = params.unit, weekdayOfMonth;
      if (!edgeIndex) {
        // If we have "the end of January", then we need to find the unit index.
        iterateOverHigherDateParams(params, function(unitName, val, unit, i) {
          if (unitName === 'weekday' && isDefined(params.month)) {
            // If both a month and weekday exist, then we have a format like
            // "the last tuesday in November, 2012", where the "last" is still
            // relative to the end of the month, so prevent the unit "weekday"
            // from taking over.
            return;
          }
          edgeIndex = i;
        });
      }
      if (edgeIndex === MONTH_INDEX && isDefined(params.weekday)) {
        // If a weekday in a month exists (as described above),
        // then set it up to be set after the date has been shifted.
        weekdayOfMonth = params.weekday;
        delete params.weekday;
      }
      afterDateSet(function() {
        var stopIndex;
        // "edge" values that are at the very edge are "2" so the beginning of the
        // year is -2 and the end of the year is 2. Conversely, the "last day" is
        // actually 00:00am so it is 1. -1 is reserved but unused for now.
        if (edge < 0) {
          moveToBeginningOfUnit(date, edgeIndex, optLocale);
        } else if (edge > 0) {
          if (edge === 1) {
            stopIndex = DAY_INDEX;
            moveToBeginningOfUnit(date, DAY_INDEX);
          }
          moveToEndOfUnit(date, edgeIndex, optLocale, stopIndex);
        }
        if (isDefined(weekdayOfMonth)) {
          setWeekday(date, weekdayOfMonth, -edge);
          resetTime(date);
        }
      });
      if (edgeIndex === MONTH_INDEX) {
        params.specificity = DAY_INDEX;
      } else {
        params.specificity = edgeIndex - 1;
      }
    }

    function setOrdinalWeekday(num) {
      // If we have "the 2nd Tuesday of June", then pass the "weekdayDir"
      // flag along to updateDate so that the date does not accidentally traverse
      // into the previous month. This needs to be independent of the "prefer"
      // flag because we are only ensuring that the weekday is in the future, not
      // the entire date.
      set.weekday = 7 * (num - 1) + set.weekday;
      set.date = 1;
      weekdayDir = 1;
    }

    function separateAbsoluteUnits(unitIndex) {
      var params;

      iterateOverDateParams(set, function(name, val, unit, i) {
        // If there is a time unit set that is more specific than
        // the matched unit we have a string like "5:30am in 2 minutes",
        // which is meaningless, so invalidate the date...
        if (i >= unitIndex) {
          date.setTime(NaN);
          return false;
        } else if (i < unitIndex) {
          // ...otherwise set the params to set the absolute date
          // as a callback after the relative date has been set.
          params = params || {};
          params[name] = val;
          deleteDateParam(set, name);
        }
      });
      if (params) {
        afterDateSet(function() {
          updateDate(date, params, true, 0, false, weekdayDir);
          if (optParams) {
            simpleMerge(optParams, params);
          }
        });
        if (set.edge) {
          // "the end of March of next year"
          handleEdge(set.edge, params);
          delete set.edge;
        }
      }
    }

    if (contextDate && d) {
      // If a context date is passed ("get" and "unitsFromNow"),
      // then use it as the starting point.
      date = cloneDateByFlag(contextDate, true);
    } else {
      date = getNewDate();
    }

    _utc(date, optFromUTC);

    if (isString(d)) {
      date = parseStringDate(d);
    } else if (isDate(d)) {
      date = cloneDateByFlag(d, optClone || forceClone);
    } else if (isObjectType(d)) {
      set = simpleClone(d);
      updateDate(date, set, true);
    } else if (isNumber(d) || d === null) {
      date.setTime(d);
    }
    // A date created by parsing a string presumes that the format *itself* is
    // UTC, but not that the date, once created, should be manipulated as such. In
    // other words, if you are creating a date object from a server time
    // "2012-11-15T12:00:00Z", in the majority of cases you are using it to create
    // a date that will, after creation, be manipulated as local, so reset the utc
    // flag here unless "setUTC" is also set.
    _utc(date, !!optSetUTC);
    return {
      set: set,
      date: date
    };
  }

  // TODO: consolidate arguments into options
  function updateDate(d, params, reset, advance, prefer, weekdayDir, contextDate) {
    var upperUnitIndex;

    function setUpperUnit(unitName, unitIndex) {
      if (prefer && !upperUnitIndex) {
        if (unitName === 'weekday') {
          upperUnitIndex = WEEK_INDEX;
        } else {
          upperUnitIndex = getHigherUnitIndex(unitIndex);
        }
      }
    }

    function setSpecificity(unitIndex) {
      // Other functions may preemptively set the specificity before arriving
      // here so concede to them if they have already set more specific units.
      if (unitIndex > params.specificity) {
        return;
      }
      params.specificity = unitIndex;
    }

    function canDisambiguate() {
      if (!upperUnitIndex || upperUnitIndex > YEAR_INDEX) {
        return;
      }

      switch(prefer) {
        case -1: return d >= (contextDate || getNewDate());
        case  1: return d <= (contextDate || getNewDate());
      }
    }

    function disambiguateHigherUnit() {
      var unit = DateUnits[upperUnitIndex];
      advance = prefer;
      setUnit(unit.name, 1, unit, upperUnitIndex);
    }

    function handleFraction(unit, unitIndex, fraction) {
      if (unitIndex) {
        var lowerUnit = DateUnits[getLowerUnitIndex(unitIndex)];
        var val = round(unit.multiplier / lowerUnit.multiplier * fraction);
        params[lowerUnit.name] = val;
      }
    }

    function monthHasShifted(d, targetMonth) {
      if (targetMonth < 0) {
        targetMonth = targetMonth % 12 + 12;
      }
      return targetMonth % 12 !== getMonth(d);
    }

    function setUnit(unitName, value, unit, unitIndex) {
      var method = unit.method, checkMonth, fraction;

      setUpperUnit(unitName, unitIndex);
      setSpecificity(unitIndex);

      fraction = value % 1;
      if (fraction) {
        handleFraction(unit, unitIndex, fraction);
        value = trunc(value);
      }

      if (unitName === 'weekday') {
        if (!advance) {
          // Weekdays are always considered absolute units so simply set them
          // here even if it is an "advance" operation. This is to help avoid
          // ambiguous meanings in "advance" as well as to neatly allow formats
          // like "Wednesday of next week" without more complex logic.
          setWeekday(d, value, weekdayDir);
        }
        return;
      }
      checkMonth = unitIndex === MONTH_INDEX && getDate(d) > 28;

      // If we are advancing or rewinding, then we need we need to set the
      // absolute time if the unit is "hours" or less. This is due to the fact
      // that setting by method is ambiguous during DST shifts. For example,
      // 1:00am on November 1st 2015 occurs twice in North American timezones
      // with DST, the second time being after the clocks are rolled back at
      // 2:00am. When springing forward this is automatically handled as there
      // is no 2:00am so the date automatically jumps to 3:00am. However, when
      // rolling back, setHours(2) will always choose the first "2am" even if
      // the date is currently set to the second, causing unintended jumps.
      // This ambiguity is unavoidable when setting dates as the notation is
      // ambiguous. However when advancing, we clearly want the resulting date
      // to be an acutal hour ahead, which can only be accomplished by setting
      // the absolute time. Conversely, any unit higher than "hours" MUST use
      // the internal set methods, as they are ambiguous as absolute units of
      // time. Years may be 365 or 366 days depending on leap years, months are
      // all over the place, and even days may be 23-25 hours depending on DST
      // shifts. Finally, note that the kind of jumping described above will
      // occur when calling ANY "set" method on the date and will occur even if
      // the value being set is identical to the one currently set (i.e.
      // setHours(2) on a date at 2am may not be a noop). This is precarious,
      // so avoiding this situation in callDateSet by checking up front that
      // the value is not the same before setting.
      if (advance && !unit.ambiguous) {
        d.setTime(d.getTime() + (value * advance * unit.multiplier));
        return;
      } else if (advance) {
        if (unitIndex === WEEK_INDEX) {
          value *= 7;
          method = DateUnits[DAY_INDEX].method;
        }
        value = (value * advance) + callDateGet(d, method);
      }
      callDateSetWithWeek(d, method, value, advance);
      if (checkMonth && monthHasShifted(d, value)) {
        // As we are setting the units in reverse order, there is a chance that
        // our date may accidentally traverse into a new month, such as setting
        // { month: 1, date 15 } on January 31st. Check for this here and reset
        // the date to the last day of the previous month if this has happened.
        setDate(d, 0);
      }
    }

    if (isNumber(params) && advance) {
      // If param is a number and advancing, the number is in milliseconds.
      params = { millisecond: params };
    } else if (isNumber(params)) {
      // Otherwise just set the timestamp and return.
      d.setTime(params);
      return d;
    }

    iterateOverDateParams(params, setUnit);

    if (reset && params.specificity) {
      resetLowerUnits(d, params.specificity);
    }

    // If past or future is preferred, then the process of "disambiguation" will
    // ensure that an ambiguous time/date ("4pm", "thursday", "June", etc.) will
    // be in the past or future. Weeks are only considered ambiguous if there is
    // a weekday, i.e. "thursday" is an ambiguous week, but "the 4th" is an
    // ambiguous month.
    if (canDisambiguate()) {
      disambiguateHigherUnit();
    }
    return d;
  }

  // Locales

  // Locale helpers
  var English, localeManager;

  function getEnglishVariant(v) {
    return simpleMerge(simpleClone(EnglishLocaleBaseDefinition), v);
  }

  function arrayToRegAlternates(arr) {
    var joined = arr.join('');
    if (!arr || !arr.length) {
      return '';
    }
    if (joined.length === arr.length) {
      return '[' + joined + ']';
    }
    // map handles sparse arrays so no need to compact the array here.
    return map(arr, escapeRegExp).join('|');
  }

  function getRegNonCapturing(src, opt) {
    if (src.length > 1) {
      src = '(?:' + src + ')';
    }
    if (opt) {
      src += '?';
    }
    return src;
  }

  function getParsingTokenWithSuffix(field, src, suffix) {
    var token = LocalizedParsingTokens[field];
    if (token.requiresSuffix) {
      src = getRegNonCapturing(src + getRegNonCapturing(suffix));
    } else if (token.requiresSuffixOr) {
      src += getRegNonCapturing(token.requiresSuffixOr + '|' + suffix);
    } else {
      src += getRegNonCapturing(suffix, true);
    }
    return src;
  }

  function getArrayWithOffset(arr, n, alternate, offset) {
    var val;
    if (alternate > 1) {
      val = arr[n + (alternate - 1) * offset];
    }
    return val || arr[n];
  }

  function buildLocales() {

    function LocaleManager(loc) {
      this.locales = {};
      this.add(loc);
    }

    LocaleManager.prototype = {

      get: function(code, fallback) {
        var loc = this.locales[code];
        if (!loc && LazyLoadedLocales[code]) {
          loc = this.add(code, LazyLoadedLocales[code]);
        } else if (!loc && code) {
          loc = this.locales[code.slice(0, 2)];
        }
        return loc || fallback === false ? loc : this.current;
      },

      getAll: function() {
        return this.locales;
      },

      set: function(code) {
        var loc = this.get(code, false);
        if (!loc) {
          throw new TypeError('Invalid Locale: ' + code);
        }
        return this.current = loc;
      },

      add: function(code, def) {
        if (!def) {
          def = code;
          code = def.code;
        } else {
          def.code = code;
        }
        var loc = def.compiledFormats ? def : getNewLocale(def);
        this.locales[code] = loc;
        if (!this.current) {
          this.current = loc;
        }
        return loc;
      },

      remove: function(code) {
        if (this.current.code === code) {
          this.current = this.get('en');
        }
        return delete this.locales[code];
      }

    };

    // Sorry about this guys...
    English = getNewLocale(AmericanEnglishDefinition);
    localeManager = new LocaleManager(English);
  }

  function getNewLocale(def) {

    function Locale(def) {
      this.init(def);
    }

    Locale.prototype = {

      getMonthName: function(n, alternate) {
        if (this.monthSuffix) {
          return (n + 1) + this.monthSuffix;
        }
        return getArrayWithOffset(this.months, n, alternate, 12);
      },

      getWeekdayName: function(n, alternate) {
        return getArrayWithOffset(this.weekdays, n, alternate, 7);
      },

      // TODO: rename to parse in next major version
      parseValue: function(str, param) {
        var map = this[param + 'Map'];
        if (hasOwn(map, str)) {
          return map[str];
        }
        return this.parseNumber(str, param);
      },

      // TODO: analyze performance of parsing first vs checking
      // numeralMap first.
      parseNumber: function(str, param) {
        var val;

        // Simple numerals such as "one" are mapped directly in
        // the numeral map so catch up front if there is a match.
        if (hasOwn(this.numeralMap, str)) {
          val = this.numeralMap[str];
        }

        // TODO: perf test isNaN vs other methods
        if (isNaN(val)) {
          val = this.parseRegularNumerals(str);
        }

        if (isNaN(val)) {
          val = this.parseIrregularNumerals(str);
        }

        if (param === 'month') {
          // Months are the only numeric date field
          // whose value is not the same as its number.
          val -= 1;
        }

        return val;
      },

      // TODO: perf test returning up front if no regular decimals exist
      parseRegularNumerals: function(str) {
        // Allow decimals as commas and the minus-sign as per ISO-8601.
        str = str.replace(/^−/, '-').replace(/,/, '.');

        // The unary plus operator here shows better performance and handles
        // every format that parseFloat does with the exception of trailing
        // characters, which are guaranteed not to be in our string at this point.
        return +str;
      },

      parseIrregularNumerals: function(str) {
        var place = 1, num = 0, lastWasPlace, isPlace, numeral, digit, arr;

        // Note that "numerals" that need to be converted through this method are
        // all considered to be single characters in order to handle CJK. This
        // method is by no means unique to CJK, but the complexity of handling
        // inflections in non-CJK languages adds too much overhead for not enough
        // value, so avoiding for now.
        arr = str.split('');
        for (var i = arr.length - 1; numeral = arr[i]; i--) {
          digit = getOwn(this.numeralMap, numeral);
          if (isUndefined(digit)) {
            digit = getOwn(fullWidthNumberMap, numeral) || 0;
          }
          isPlace = digit > 0 && digit % 10 === 0;
          if (isPlace) {
            if (lastWasPlace) {
              num += place;
            }
            if (i) {
              place = digit;
            } else {
              num += digit;
            }
          } else {
            num += digit * place;
            place *= 10;
          }
          lastWasPlace = isPlace;
        }
        return num;
      },

      getOrdinal: function(n) {
        var suffix = this.ordinalSuffix;
        return suffix || getOrdinalSuffix(n);
      },

      getRelativeFormat: function(adu, type) {
        return this.convertAdjustedToFormat(adu, type);
      },

      getDuration: function(ms) {
        return this.convertAdjustedToFormat(getAdjustedUnitForNumber(max(0, ms)), 'duration');
      },

      getFirstDayOfWeek: function() {
        var val = this.firstDayOfWeek;
        return isDefined(val) ? val : ISO_FIRST_DAY_OF_WEEK;
      },

      getFirstDayOfWeekYear: function() {
        return this.firstDayOfWeekYear || ISO_FIRST_DAY_OF_WEEK_YEAR;
      },

      convertAdjustedToFormat: function(adu, type) {
        var sign, unit, mult,
            num    = adu[0],
            u      = adu[1],
            ms     = adu[2],
            format = this[type] || this.relative;
        if (isFunction(format)) {
          return format.call(this, num, u, ms, type);
        }
        mult = !this.plural || num === 1 ? 0 : 1;
        unit = this.units[mult * 8 + u] || this.units[u];
        sign = this[ms > 0 ? 'fromNow' : 'ago'];
        return format.replace(/\{(.*?)\}/g, function(full, match) {
          switch(match) {
            case 'num': return num;
            case 'unit': return unit;
            case 'sign': return sign;
          }
        });
      },

      cacheFormat: function(dif, i) {
        this.compiledFormats.splice(i, 1);
        this.compiledFormats.unshift(dif);
      },

      addFormat: function(format) {
        var loc = this, src, to;

        function getTokenSrc(token) {
          var suffix, src, tmp,
              opt   = token.match(/\?$/),
              nc    = token.match(/^(\d+)\??$/),
              slice = token.match(/(\d)(?:-(\d))?/),
              param = token.replace(/[^a-z]+$/i, '');

          // Allowing alias tokens such as {time}
          if (tmp = getOwn(loc.parsingAliases, param)) {
            src = formatToSrc(tmp);
            if (opt) {
              src = getRegNonCapturing(src, true);
            }
            return src;
          }

          if (nc) {
            src = loc.tokens[nc[1]];
          } else if (tmp = getOwn(CoreParsingTokens, param)) {
            src = tmp.src;
            param = tmp.param || param;
          } else {
            tmp = getOwn(loc.parsingTokens, param) || getOwn(loc, param);

            // Both the "months" array and the "month" parsing token can be accessed
            // by either {month} or {months}, falling back as necessary, however
            // regardless of whether or not a fallback occurs, the final field to
            // be passed to addRawFormat must be normalized as singular.
            param = param.replace(/s$/, '');

            if (!tmp) {
              tmp = getOwn(loc.parsingTokens, param) || getOwn(loc, param + 's');
            }

            if (isString(tmp)) {
              src = tmp;
              suffix = loc[param + 'Suffix'];
            } else {

              // This is a hack to temporarily disallow parsing of single character
              // weekdays until the format can be changed to allow for this.
              if (param === 'weekday' && loc.code === 'ko') {
                tmp = tmp.filter(function(str) {
                  return str.length > 1;
                });
              }

              if (slice) {
                tmp = filter(tmp, function(m, i) {
                  var mod = i % (loc.units ? 8 : tmp.length);
                  return mod >= slice[1] && mod <= (slice[2] || slice[1]);
                });
              }
              src = arrayToRegAlternates(tmp);
            }
          }
          if (!src) {
            return '';
          }
          if (nc) {
            // Non-capturing tokens like {0}
            src = getRegNonCapturing(src);
          } else {
            // Capturing group and add to parsed tokens
            to.push(param);
            src = '(' + src + ')';
          }
          if (suffix) {
            // Date/time suffixes such as those in CJK
            src = getParsingTokenWithSuffix(param, src, suffix);
          }
          if (opt) {
            src += '?';
          }
          return src;
        }

        function formatToSrc(str) {

          // Make spaces optional
          str = str.replace(/ /g, ' ?');

          str = str.replace(/\{([^,]+?)\}/g, function(match, token) {
            var tokens = token.split('|');
            if (tokens.length > 1) {
              return getRegNonCapturing(map(tokens, getTokenSrc).join('|'));
            } else {
              return getTokenSrc(token);
            }
          });

          return str;
        }

        function parseInputFormat() {
          to = [];
          src = formatToSrc(format);
        }

        parseInputFormat();
        loc.addRawFormat(src, to);
      },

      addRawFormat: function(format, to) {
        this.compiledFormats.unshift({
          reg: RegExp('^ *' + format + ' *$', 'i'),
          to: to
        });
      },

      init: function(def) {
        var loc = this;

        // -- Initialization helpers

        function initFormats() {
          loc.compiledFormats = [];
          loc.parsingAliases = {};
          loc.parsingTokens = {};
        }

        function initDefinition() {
          simpleMerge(loc, def);
        }

        function initArrayFields() {
          forEach(LOCALE_ARRAY_FIELDS, function(name) {
            var val = loc[name];
            if (isString(val)) {
              loc[name] = commaSplit(val);
            } else if (!val) {
              loc[name] = [];
            }
          });
        }

        // -- Value array build helpers

        function buildValueArray(name, mod, map, fn) {
          var field = name, all = [], setMap;
          if (!loc[field]) {
            field += 's';
          }
          if (!map) {
            map = {};
            setMap = true;
          }
          forAllAlternates(field, function(alt, j, i) {
            var idx = j * mod + i, val;
            val = fn ? fn(i) : i;
            map[alt] = val;
            map[alt.toLowerCase()] = val;
            all[idx] = alt;
          });
          loc[field] = all;
          if (setMap) {
            loc[name + 'Map'] = map;
          }
        }

        function forAllAlternates(field, fn) {
          forEach(loc[field], function(str, i) {
            forEachAlternate(str, function(alt, j) {
              fn(alt, j, i);
            });
          });
        }

        function forEachAlternate(str, fn) {
          var arr = map(str.split('+'), function(split) {
            return split.replace(/(.+):(.+)$/, function(full, base, suffixes) {
              return map(suffixes.split('|'), function(suffix) {
                return base + suffix;
              }).join('|');
            });
          }).join('|');
          forEach(arr.split('|'), fn);
        }

        function buildNumerals() {
          var map = {};
          buildValueArray('numeral', 10, map);
          buildValueArray('article', 1, map, function() {
            return 1;
          });
          buildValueArray('placeholder', 4, map, function(n) {
            return pow(10, n + 1);
          });
          loc.numeralMap = map;
        }

        function buildTimeFormats() {
          loc.parsingAliases['time'] = getTimeFormat();
          loc.parsingAliases['tzOffset'] = getTZOffsetFormat();
        }

        function getTimeFormat(standalone) {
          var src, sep;
          sep = getTimeSeparatorSrc(standalone);
          if (loc.ampmFront) {
            // "ampmFront" exists mostly for CJK locales, which also presume that
            // time suffixes exist, allowing this to be a simpler regex.
            src = '{ampm?} {hour} (?:{minute} (?::?{second})?)?';
          } else if(loc.ampm.length) {
            src = '{hour}(?:'+sep+'{minute?}(?:'+sep+'{second?})? {ampm?}| {ampm})';
          } else {
            src = '{hour}(?:'+sep+'{minute?}(?:'+sep+'{second?})?)';
          }
          return src;
        }

        function getTimeSeparatorSrc() {
          if (loc.timeSeparator) {
            return '[:' + loc.timeSeparator + ']';
          } else {
            return ':';
          }
        }

        function getTZOffsetFormat() {
          return '(?:{Z}|{GMT?}(?:{tzHour}(?::?{tzMinute}(?: \\([\\w\\s]+\\))?)?)?)?';
        }

        function buildParsingTokens() {
          forEachProperty(LocalizedParsingTokens, function(token, name) {
            var src = token.base ? getCoreTokensForBase(token.base) : token.src, arr;
            if (token.requiresNumerals || loc.numeralUnits) {
              src += getNumeralSrc();
            }
            arr = loc[name + 's'];
            if (arr && arr.length) {
              src += '|' + arrayToRegAlternates(arr);
            }
            loc.parsingTokens[name] = src;
          });
        }

        function getCoreTokensForBase(base) {
          return base.split('|').map(function(key) {
            return CoreParsingTokens[key].src;
          }).join('|');
        }

        function getNumeralSrc() {
          var all, src = '';
          all = loc.numerals.concat(loc.placeholders).concat(loc.articles);
          if (loc.allowsFullWidth) {
            all = all.concat(fullWidthNumbers.split(''));
          }
          if (all.length) {
            src = '|(?:' + arrayToRegAlternates(all) + ')+';
          }
          return src;
        }

        function buildTimeSuffixes() {
          iterateOverDateUnits(function(unit, i) {
            var token = loc.timeSuffixes[i];
            if (token) {
              loc[(unit.alias || unit.name) + 'Suffix'] = token;
            }
          });
        }

        function buildModifiers() {
          forEach(loc.modifiers, function(modifier) {
            var name = modifier.name, mapKey = name + 'Map', map;
            map = loc[mapKey] || {};
            forEachAlternate(modifier.src, function(alt, j) {
              var token = getOwn(loc.parsingTokens, name), val = modifier.value;
              map[alt] = val;
              loc.parsingTokens[name] = token ? token + '|' + alt : alt;
              if (modifier.name === 'sign' && j === 0) {
                // Hooking in here to set the first "fromNow" or "ago" modifier
                // directly on the locale, so that it can be reused in the
                // relative format.
                loc[val === 1 ? 'fromNow' : 'ago'] = alt;
              }
            });
            loc[mapKey] = map;
          });
        }

        // -- Format adding helpers

        function addCoreFormats() {
          forEach(CoreParsingFormats, function(df) {
            var src = df.src;
            if (df.localeCheck && !df.localeCheck(loc)) {
              return;
            }
            if (df.mdy && loc.mdy) {
              // Use the mm/dd/yyyy variant if it
              // exists and the locale requires it
              src = df.mdy;
            }
            if (df.time) {
              // Core formats that allow time require the time
              // reg on both sides, so add both versions here.
              loc.addFormat(getFormatWithTime(src, true));
              loc.addFormat(getFormatWithTime(src));
            } else {
              loc.addFormat(src);
            }
          });
          loc.addFormat('{time}');
        }

        function addLocaleFormats() {
          addFormatSet('parse');
          addFormatSet('timeParse', true);
          addFormatSet('timeFrontParse', true, true);
        }

        function addFormatSet(field, allowTime, timeFront) {
          forEach(loc[field], function(format) {
            if (allowTime) {
              format = getFormatWithTime(format, timeFront);
            }
            loc.addFormat(format);
          });
        }

        function getFormatWithTime(baseFormat, timeBefore) {
          if (timeBefore) {
            return getTimeBefore() + baseFormat;
          }
          return baseFormat + getTimeAfter();
        }

        function getTimeBefore() {
          return getRegNonCapturing('{time}[,\\s\\u3000]', true);
        }

        function getTimeAfter() {
          var markers = ',?[\\s\\u3000]', localized;
          localized = arrayToRegAlternates(loc.timeMarkers);
          if (localized) {
            markers += '| (?:' + localized + ') ';
          }
          markers = getRegNonCapturing(markers, loc.timeMarkerOptional);
          return getRegNonCapturing(markers + '{time}{tzOffset}', true);
        }

        initFormats();
        initDefinition();
        initArrayFields();

        buildValueArray('month', 12);
        buildValueArray('weekday', 7);
        buildValueArray('unit', 8);
        buildValueArray('ampm', 2);

        buildNumerals();
        buildTimeFormats();
        buildParsingTokens();
        buildTimeSuffixes();
        buildModifiers();

        // The order of these formats is important. Order is reversed so formats
        // that are initialized later will take precedence. Generally, this means
        // that more specific formats should come later.
        addCoreFormats();
        addLocaleFormats();

      }

    };

    return new Locale(def);
  }


  
  function buildDateUnitMethods() {

    defineInstanceSimilar(sugarDate, DateUnits, function(methods, unit, index) {
      var name = unit.name, caps = simpleCapitalize(name);

      if (index > DAY_INDEX) {
        forEach(['Last','This','Next'], function(shift) {
          methods['is' + shift + caps] = function(d, localeCode) {
            return compareDate(d, shift + ' ' + name, 0, localeCode, { locale: 'en' });
          };
        });
      }
      if (index > HOURS_INDEX) {
        methods['beginningOf' + caps] = function(d, localeCode) {
          return moveToBeginningOfUnit(d, index, localeCode);
        };
        methods['endOf' + caps] = function(d, localeCode) {
          return moveToEndOfUnit(d, index, localeCode);
        };
      }

      methods['add' + caps + 's'] = function(d, num, reset) {
        return advanceDate(d, name, num, reset);
      };

      var since = function(date, d, options) {
        return getTimeDistanceForUnit(date, createDate(d, options, true), unit);
      };
      var until = function(date, d, options) {
        return getTimeDistanceForUnit(createDate(d, options, true), date, unit);
      };

      methods[name + 'sAgo']   = methods[name + 'sUntil']   = until;
      methods[name + 'sSince'] = methods[name + 'sFromNow'] = since;

    });

  }

  
  function buildRelativeAliases() {
    var special  = spaceSplit('Today Yesterday Tomorrow Weekday Weekend Future Past');
    var weekdays = English.weekdays.slice(0, 7);
    var months   = English.months.slice(0, 12);
    var together = special.concat(weekdays).concat(months);
    defineInstanceSimilar(sugarDate, together, function(methods, name) {
      methods['is'+ name] = function(d) {
        return fullCompareDate(d, name);
      };
    });
  }

  defineStatic(sugarDate, {

    
    'create': function(d, options) {
      return createDate(d, options);
    },

    
    'getLocale': function(code) {
      return localeManager.get(code, !code);
    },

    
    'getAllLocales': function() {
      return localeManager.getAll();
    },

    
    'getAllLocaleCodes': function() {
      return getKeys(localeManager.getAll());
    },

    
    'setLocale': function(code) {
      return localeManager.set(code);
    },

    
    'addLocale': function(code, set) {
      return localeManager.add(code, set);
    },

    
    'removeLocale': function(code) {
      return localeManager.remove(code);
    }

  });

  defineInstanceWithArguments(sugarDate, {

    
    'set': function(d, args) {
      args = collectUpdateDateArguments(args);
      return updateDate(d, args[0], args[1]);
    },

    
    'advance': function(d, args) {
      return advanceDateWithArgs(d, args, 1);
    },

    
    'rewind': function(d, args) {
      return advanceDateWithArgs(d, args, -1);
    }

  });

  defineInstance(sugarDate, {

    
    'get': function(date, d, options) {
      return createDateWithContext(date, d, options);
    },

    
    'setWeekday': function(date, dow) {
      return setWeekday(date, dow);
    },

    
    'setISOWeek': function(date, num) {
      return setISOWeekNumber(date, num);
    },

    
    'getISOWeek': function(date) {
      return getWeekNumber(date, true);
    },

    
    'beginningOfISOWeek': function(date) {
      var day = getWeekday(date);
      if (day === 0) {
        day = -6;
      } else if (day !== 1) {
        day = 1;
      }
      setWeekday(date, day);
      return resetTime(date);
    },

    
    'endOfISOWeek': function(date) {
      if (getWeekday(date) !== 0) {
        setWeekday(date, 7);
      }
      return moveToEndOfUnit(date, DAY_INDEX);
    },

    
    'getUTCOffset': function(date, iso) {
      return getUTCOffset(date, iso);
    },

    
    'setUTC': function(date, on) {
      return _utc(date, on);
    },

    
    'isUTC': function(date) {
      return isUTC(date);
    },

    
    'isValid': function(date) {
      return dateIsValid(date);
    },

    
    'isAfter': function(date, d, margin) {
      return date.getTime() > createDate(d).getTime() - (margin || 0);
    },

    
    'isBefore': function(date, d, margin) {
      return date.getTime() < createDate(d).getTime() + (margin || 0);
    },

    
    'isBetween': function(date, d1, d2, margin) {
      var t  = date.getTime();
      var t1 = createDate(d1).getTime();
      var t2 = createDate(d2).getTime();
      var lo = min(t1, t2);
      var hi = max(t1, t2);
      margin = margin || 0;
      return (lo - margin <= t) && (hi + margin >= t);
    },

    
    'isLeapYear': function(date) {
      var year = getYear(date);
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    },

    
    'daysInMonth': function(date) {
      return getDaysInMonth(date);
    },

    
    'format': function(date, f, localeCode) {
      return dateFormat(date, f, localeCode);
    },

    
    'relative': function(date, localeCode, relativeFn) {
      return dateRelative(date, null, localeCode, relativeFn);
    },

    
    'relativeTo': function(date, d, localeCode) {
      return dateRelative(date, createDate(d), localeCode);
    },

    
    'is': function(date, d, margin) {
      return fullCompareDate(date, d, margin);
    },

    
    'reset': function(date, unit, localeCode) {
      var unitIndex = unit ? getUnitIndexForParamName(unit) : DAY_INDEX;
      moveToBeginningOfUnit(date, unitIndex, localeCode);
      return date;
    },

    
    'clone': function(date) {
      return cloneDate(date);
    },

    
    'iso': function(date) {
      return date.toISOString();
    },

    
    'getWeekday': function(date) {
      return getWeekday(date);
    },

    
    'getUTCWeekday': function(date) {
      return date.getUTCDay();
    }

  });


  

  
  function buildNumberUnitMethods() {
    defineInstanceSimilar(sugarNumber, DateUnits, function(methods, unit) {
      var name = unit.name, base, after, before;
      base = function(n) {
        return round(n * unit.multiplier);
      };
      after = function(n, d, options) {
        return advanceDate(createDate(d, options, true), name, n);
      };
      before = function(n, d, options) {
        return advanceDate(createDate(d, options, true), name, -n);
      };
      methods[name] = base;
      methods[name + 's'] = base;
      methods[name + 'Before'] = before;
      methods[name + 'sBefore'] = before;
      methods[name + 'Ago'] = before;
      methods[name + 'sAgo'] = before;
      methods[name + 'After'] = after;
      methods[name + 'sAfter'] = after;
      methods[name + 'FromNow'] = after;
      methods[name + 'sFromNow'] = after;
    });
  }

  defineInstance(sugarNumber, {

    
    'duration': function(n, localeCode) {
      return localeManager.get(localeCode).getDuration(n);
    }

  });


  var EnglishLocaleBaseDefinition = {
    'code': 'en',
    'plural': true,
    'timeMarkers': 'at',
    'ampm': 'AM|A.M.|a,PM|P.M.|p',
    'units': 'millisecond:|s,second:|s,minute:|s,hour:|s,day:|s,week:|s,month:|s,year:|s',
    'months': 'Jan:uary|,Feb:ruary|,Mar:ch|,Apr:il|,May,Jun:e|,Jul:y|,Aug:ust|,Sep:tember|t|,Oct:ober|,Nov:ember|,Dec:ember|',
    'weekdays': 'Sun:day|,Mon:day|,Tue:sday|,Wed:nesday|,Thu:rsday|,Fri:day|,Sat:urday|+weekend',
    'numerals': 'zero,one|first,two|second,three|third,four:|th,five|fifth,six:|th,seven:|th,eight:|h,nin:e|th,ten:|th',
    'articles': 'a,an,the',
    'tokens': 'the,st|nd|rd|th,of|in,a|an,on',
    'time': '{H}:{mm}',
    'past': '{num} {unit} {sign}',
    'future': '{num} {unit} {sign}',
    'duration': '{num} {unit}',
    'modifiers': [
      { 'name': 'half',   'src': 'half', 'value': .5 },
      { 'name': 'midday', 'src': 'noon', 'value': 12 },
      { 'name': 'midday', 'src': 'midnight', 'value': 24 },
      { 'name': 'day',    'src': 'yesterday', 'value': -1 },
      { 'name': 'day',    'src': 'today|tonight', 'value': 0 },
      { 'name': 'day',    'src': 'tomorrow', 'value': 1 },
      { 'name': 'sign',   'src': 'ago|before', 'value': -1 },
      { 'name': 'sign',   'src': 'from now|after|from|in|later', 'value': 1 },
      { 'name': 'edge',   'src': 'first day|first|beginning', 'value': -2 },
      { 'name': 'edge',   'src': 'last day', 'value': 1 },
      { 'name': 'edge',   'src': 'end|last', 'value': 2 },
      { 'name': 'shift',  'src': 'last', 'value': -1 },
      { 'name': 'shift',  'src': 'the|this', 'value': 0 },
      { 'name': 'shift',  'src': 'next', 'value': 1 }
    ],
    'parse': [
      '(?:just)? now',
      '{shift} {unit:5-7}',
      '{months?} {year}',
      '{midday} {4?} {day|weekday}',
      '{months},?[-.\\/\\s]?{year?}',
      '{edge} of (?:day)? {day|weekday}',
      '{0} {num}{1?} {weekday} {2} {months},? {year?}',
      '{shift?} {day?} {weekday?} (?:at)? {midday}',
      '{sign?} {3?} {half} {3?} {unit:3-4|unit:7} {sign?}',
      '{0?} {edge} {weekday?} {2} {shift?} {unit:4-7?} {months?},? {year?}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift} {unit:5?} {weekday}',
      '{0?} {date}{1?} {2?} {months?}',
      '{weekday} {2?} {shift} {unit:5}',
      '{0?} {num} {2?} {months}\\.?,? {year?}',
      '{num?} {unit:4-5} {sign} {day|weekday}',
      '{0|months} {date?}{1?} of {shift} {unit:6-7}',
      '{0?} {num}{1?} {weekday} of {shift} {unit:6}',
      '{year?}[-.\\/\\s]?{months}[-.\\/\\s]{date}',
      '{date}[-.\\/\\s]{months}(?:[-.\\/\\s]{year|yy})?',
      '{weekday?}\\.?,? {months}\\.?,? {date}{1?},? {year?}',
      '{weekday?}\\.?,? {date} {months} {year}'
    ],
    'timeFrontParse': [
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{4?} {day|weekday}'
    ]
  };

  var AmericanEnglishDefinition = getEnglishVariant({
    'mdy': true,
    'firstDayOfWeek': 0,
    'firstDayOfWeekYear': 1,
    'short':  '{MM}/{dd}/{yyyy}',
    'medium': '{Month} {d}, {yyyy}',
    'long':   '{Month} {d}, {yyyy} {time}',
    'full':   '{Weekday}, {Month} {d}, {yyyy} {time}',
    'stamp':  '{Dow} {Mon} {d} {yyyy} {time}',
    'time':   '{h}:{mm} {TT}'
  });

  var BritishEnglishDefinition = getEnglishVariant({
    'short':  '{dd}/{MM}/{yyyy}',
    'medium': '{d} {Month} {yyyy}',
    'long':   '{d} {Month} {yyyy} {H}:{mm}',
    'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
    'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
  });

  var CanadianEnglishDefinition = getEnglishVariant({
    'short':  '{yyyy}-{MM}-{dd}',
    'medium': '{d} {Month}, {yyyy}',
    'long':   '{d} {Month}, {yyyy} {H}:{mm}',
    'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
    'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
  });

  var LazyLoadedLocales = {
    'en-US': AmericanEnglishDefinition,
    'en-GB': BritishEnglishDefinition,
    'en-AU': BritishEnglishDefinition,
    'en-CA': CanadianEnglishDefinition
  };

  buildLocales();
  buildDateFormatTokens();
  buildDateFormatMatcher();
  buildDateUnitMethods();
  buildNumberUnitMethods();
  buildRelativeAliases();
  setDateChainableConstructor();

  

  var DURATION_UNITS = 'year|month|week|day|hour|minute|second|millisecond';
  var DURATION_REG   = RegExp('(\\d+)?\\s*('+ DURATION_UNITS +')s?', 'i');

  var MULTIPLIERS = {
    'Hours': 60 * 60 * 1000,
    'Minutes': 60 * 1000,
    'Seconds': 1000,
    'Milliseconds': 1
  };

  var PrimitiveRangeConstructor = function(start, end) {
    return new Range(start, end);
  };

  function Range(start, end) {
    this.start = cloneRangeMember(start);
    this.end   = cloneRangeMember(end);
  }

  function getRangeMemberNumericValue(m) {
    return isString(m) ? m.charCodeAt(0) : m;
  }

  function getRangeMemberPrimitiveValue(m) {
    if (m == null) return m;
    return isDate(m) ? m.getTime() : m.valueOf();
  }

  function getPrecision(n) {
    var split = periodSplit(n.toString());
    return split[1] ? split[1].length : 0;
  }

  function getGreaterPrecision(n1, n2) {
    return max(getPrecision(n1), getPrecision(n2));
  }

  function cloneRangeMember(m) {
    if (isDate(m)) {
      return new Date(m.getTime());
    } else {
      return getRangeMemberPrimitiveValue(m);
    }
  }

  function isValidRangeMember(m) {
    var val = getRangeMemberPrimitiveValue(m);
    return (!!val || val === 0) && valueIsNotInfinite(m);
  }

  function valueIsNotInfinite(m) {
    return m !== -Infinity && m !== Infinity;
  }

  function rangeIsValid(range) {
    return isValidRangeMember(range.start) &&
           isValidRangeMember(range.end) &&
           typeof range.start === typeof range.end;
  }

  function rangeEvery(range, step, countOnly, fn) {
    var increment,
        precision,
        dio,
        unit,
        start   = range.start,
        end     = range.end,
        inverse = end < start,
        current = start,
        index   = 0,
        result  = [];

    if (!rangeIsValid(range)) {
      return countOnly ? NaN : [];
    }
    if (isFunction(step)) {
      fn = step;
      step = null;
    }
    step = step || 1;
    if (isNumber(start)) {
      precision = getGreaterPrecision(start, step);
      increment = function() {
        return incrementNumber(current, step, precision);
      };
    } else if (isString(start)) {
      increment = function() {
        return incrementString(current, step);
      };
    } else if (isDate(start)) {
      dio  = getDateIncrementObject(step);
      step = dio[0];
      unit = dio[1];
      increment = function() {
        return incrementDate(current, step, unit);
      };
    }
    // Avoiding infinite loops
    if (inverse && step > 0) {
      step *= -1;
    }
    while(inverse ? current >= end : current <= end) {
      if (!countOnly) {
        result.push(current);
      }
      if (fn) {
        fn(current, index, range);
      }
      current = increment();
      index++;
    }
    return countOnly ? index - 1 : result;
  }

  function getDateIncrementObject(amt) {
    var match, val, unit;
    if (isNumber(amt)) {
      return [amt, 'Milliseconds'];
    }
    match = amt.match(DURATION_REG);
    val = +match[1] || 1;
    unit = simpleCapitalize(match[2].toLowerCase());
    if (unit.match(/hour|minute|second/i)) {
      unit += 's';
    } else if (unit === 'Year') {
      unit = 'FullYear';
    } else if (unit === 'Week') {
      unit = 'Date';
      val *= 7;
    } else if (unit === 'Day') {
      unit = 'Date';
    }
    return [val, unit];
  }

  function incrementDate(src, amount, unit) {
    var mult = MULTIPLIERS[unit], d;
    if (mult) {
      d = new Date(src.getTime() + (amount * mult));
    } else {
      d = new Date(src);
      callDateSet(d, unit, callDateGet(src, unit) + amount);
    }
    return d;
  }

  function incrementString(current, amount) {
    return chr(current.charCodeAt(0) + amount);
  }

  function incrementNumber(current, amount, precision) {
    return withPrecision(current + amount, precision);
  }

  function rangeClamp(range, obj) {
    var clamped,
        start = range.start,
        end = range.end,
        min = end < start ? end : start,
        max = start > end ? start : end;
    if (obj < min) {
      clamped = min;
    } else if (obj > max) {
      clamped = max;
    } else {
      clamped = obj;
    }
    return cloneRangeMember(clamped);
  }

  defineOnPrototype(Range, {

    
    'toString': function() {
      return rangeIsValid(this) ? this.start + '..' + this.end : 'Invalid Range';
    },

    
    'isValid': function() {
      return rangeIsValid(this);
    },

    
    'span': function() {
      var n = getRangeMemberNumericValue(this.end) - getRangeMemberNumericValue(this.start);
      return rangeIsValid(this) ? abs(n) + 1 : NaN;
    },

    
    'contains': function(el) {
      if (el == null) return false;
      if (el.start && el.end) {
        return el.start >= this.start && el.start <= this.end &&
               el.end   >= this.start && el.end   <= this.end;
      } else {
        return el >= this.start && el <= this.end;
      }
    },

    
    'every': function(amount, everyFn) {
      return rangeEvery(this, amount, false, everyFn);
    },

    
    'toArray': function() {
      return rangeEvery(this);
    },

    
    'union': function(range) {
      return new Range(
        this.start < range.start ? this.start : range.start,
        this.end   > range.end   ? this.end   : range.end
      );
    },

    
    'intersect': function(range) {
      if (range.start > this.end || range.end < this.start) {
        return new Range(NaN, NaN);
      }
      return new Range(
        this.start > range.start ? this.start : range.start,
        this.end   < range.end   ? this.end   : range.end
      );
    },

    
    'clone': function() {
      return new Range(this.start, this.end);
    },

    
    'clamp': function(el) {
      return rangeClamp(this, el);
    }

  });


  

  defineStatic(sugarNumber, {

    
    'range': PrimitiveRangeConstructor

  });

  defineInstance(sugarNumber, {

    
    'upto': function(n, num, step, everyFn) {
      return rangeEvery(new Range(n, num), step, false, everyFn);
    },

    
    'clamp': function(n, start, end) {
      return rangeClamp(new Range(start, end), n);
    },

    
    'cap': function(n, max) {
      return rangeClamp(new Range(undefined, max), n);
    }

  });

  
  alias(sugarNumber, 'downto', 'upto');


  

  defineStatic(sugarString, {

    
    'range': PrimitiveRangeConstructor

  });


  


  var FULL_CAPTURED_DURATION = '((?:\\d+)?\\s*(?:' + DURATION_UNITS + '))s?';

  // Duration text formats
  var RANGE_REG_FROM_TO        = /(?:from)?\s*(.+)\s+(?:to|until)\s+(.+)$/i,
      RANGE_REG_REAR_DURATION  = RegExp('(.+)\\s*for\\s*' + FULL_CAPTURED_DURATION, 'i'),
      RANGE_REG_FRONT_DURATION = RegExp('(?:for)?\\s*'+ FULL_CAPTURED_DURATION +'\\s*(?:starting)?\\s(?:at\\s)?(.+)', 'i');

  var DateRangeConstructor = function(start, end) {
    if (arguments.length === 1 && isString(start)) {
      return createDateRangeFromString(start);
    }
    return new Range(getDateForRange(start), getDateForRange(end));
  };

  function createDateRangeFromString(str) {
    var match, datetime, duration, dio, start, end;
    if (sugarDate.get && (match = str.match(RANGE_REG_FROM_TO))) {
      start = getDateForRange(match[1].replace('from', 'at'));
      end = sugarDate.get(start, match[2]);
      return new Range(start, end);
    }
    if (match = str.match(RANGE_REG_FRONT_DURATION)) {
      duration = match[1];
      datetime = match[2];
    }
    if (match = str.match(RANGE_REG_REAR_DURATION)) {
      datetime = match[1];
      duration = match[2];
    }
    if (datetime && duration) {
      start = getDateForRange(datetime);
      dio = getDateIncrementObject(duration);
      end = incrementDate(start, dio[0], dio[1]);
    } else {
      start = str;
    }
    return new Range(getDateForRange(start), getDateForRange(end));
  }

  function getDateForRange(d) {
    if (isDate(d)) {
      return d;
    } else if (d == null) {
      return new Date();
    } else if (sugarDate.create) {
      return sugarDate.create(d);
    }
    return new Date(d);
  }

  
  function buildDateRangeUnits() {
    var methods = {};
    forEach(DURATION_UNITS.split('|'), function(unit, i) {
      var name = unit + 's', mult, fn;
      if (i < 4) {
        fn = function() {
          return rangeEvery(this, unit, true);
        };
      } else {
        mult = MULTIPLIERS[simpleCapitalize(name)];
        fn = function() {
          return trunc((this.end - this.start) / mult);
        };
      }
      methods[name] = fn;
    });
    defineOnPrototype(Range, methods);
  }

  defineStatic(sugarDate,   {

    
    'range': DateRangeConstructor

  });

  buildDateRangeUnits();

  

  var _lock     = privatePropertyAccessor('lock');
  var _timers   = privatePropertyAccessor('timers');
  var _partial  = privatePropertyAccessor('partial');
  var _canceled = privatePropertyAccessor('canceled');

  // istanbul ignore next
  var createInstanceFromPrototype = Object.create || function(prototype) {
    var ctor = function() {};
    ctor.prototype = prototype;
    return new ctor;
  };

  function setDelay(fn, ms, after, scope, args) {
    // Delay of infinity is never called of course...
    ms = coercePositiveInteger(ms || 0);
    if (!_timers(fn)) {
      _timers(fn, []);
    }
    // This is a workaround for <= IE8, which apparently has the
    // ability to call timeouts in the queue on the same tick (ms?)
    // even if functionally they have already been cleared.
    _canceled(fn, false);
    _timers(fn).push(setTimeout(function() {
      if (!_canceled(fn)) {
        after.apply(scope, args || []);
      }
    }, ms));
  }

  function cancelFunction(fn) {
    var timers = _timers(fn), timer;
    if (isArray(timers)) {
      while(timer = timers.shift()) {
        clearTimeout(timer);
      }
    }
    _canceled(fn, true);
    return fn;
  }

  function createLazyFunction(fn, ms, immediate, limit) {
    var queue = [], locked = false, execute, rounded, perExecution, result;
    ms = ms || 1;
    limit = limit || Infinity;
    rounded = ceil(ms);
    perExecution = round(rounded / ms) || 1;
    execute = function() {
      var queueLength = queue.length, maxPerRound;
      if (queueLength == 0) return;
      // Allow fractions of a millisecond by calling
      // multiple times per actual timeout execution
      maxPerRound = max(queueLength - perExecution, 0);
      while(queueLength > maxPerRound) {
        // Getting uber-meta here...
        result = Function.prototype.apply.apply(fn, queue.shift());
        queueLength--;
      }
      setDelay(lazy, rounded, function() {
        locked = false;
        execute();
      });
    };
    function lazy() {
      // If the execution has locked and it's immediate, then
      // allow 1 less in the queue as 1 call has already taken place.
      if (queue.length < limit - (locked && immediate ? 1 : 0)) {
        // Optimized: no leaking arguments
        var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
        queue.push([this, args]);
      }
      if (!locked) {
        locked = true;
        if (immediate) {
          execute();
        } else {
          setDelay(lazy, rounded, execute);
        }
      }
      // Return the memoized result
      return result;
    }
    return lazy;
  }

  // Collecting arguments in an array instead of
  // passing back the arguments object which will
  // deopt this function in V8.
  function collectArguments() {
    var args = arguments, i = args.length, arr = new Array(i);
    while (i--) {
      arr[i] = args[i];
    }
    return arr;
  }

  function createHashedMemoizeFunction(fn, hashFn, limit) {
    var map = {}, refs = [], counter = 0;
    return function() {
      var hashObj = hashFn.apply(this, arguments);
      var key = serializeInternal(hashObj, refs);
      if (hasOwn(map, key)) {
        return getOwn(map, key);
      }
      if (counter === limit) {
        map = {};
        refs = [];
        counter = 0;
      }
      counter++;
      return map[key] = fn.apply(this, arguments);
    };
  }

  defineInstance(sugarFunction, {

    
    'lazy': function(fn, ms, immediate, limit) {
      return createLazyFunction(fn, ms, immediate, limit);
    },

    
    'throttle': function(fn, ms) {
      return createLazyFunction(fn, ms, true, 1);
    },

    
    'debounce': function(fn, ms) {
      function debounced() {
        // Optimized: no leaking arguments
        var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
        cancelFunction(debounced);
        setDelay(debounced, ms, fn, this, args);
      }
      return debounced;
    },

    
    'cancel': function(fn) {
      return cancelFunction(fn);
    },

    
    'after': function(fn, num) {
      var count = 0, collectedArgs = [];
      num = coercePositiveInteger(num);
      return function() {
        // Optimized: no leaking arguments
        var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
        collectedArgs.push(args);
        count++;
        if (count >= num) {
          return fn.call(this, collectedArgs);
        }
      };
    },

    
    'once': function(fn) {
      var called = false, val;
      return function() {
        if (called) {
          return val;
        }
        called = true;
        return val = fn.apply(this, arguments);
      };
    },

    
    'memoize': function(fn, arg1, arg2) {
      var hashFn, limit, prop;
      if (isNumber(arg1)) {
        limit = arg1;
      } else {
        hashFn = arg1;
        limit  = arg2;
      }
      if (isString(hashFn)) {
        prop = hashFn;
        hashFn = function(obj) {
          return deepGetProperty(obj, prop);
        };
      } else if (!hashFn) {
        hashFn = collectArguments;
      }
      return createHashedMemoizeFunction(fn, hashFn, limit);
    },

    
    'lock': function(fn, n) {
      var lockedFn;
      if (_partial(fn)) {
        _lock(fn, isNumber(n) ? n : null);
        return fn;
      }
      lockedFn = function() {
        arguments.length = min(_lock(lockedFn), arguments.length);
        return fn.apply(this, arguments);
      };
      _lock(lockedFn, isNumber(n) ? n : fn.length);
      return lockedFn;
    }

  });

  defineInstanceWithArguments(sugarFunction, {

    
    'partial': function(fn, curriedArgs) {
      var curriedLen = curriedArgs.length;
      var partialFn = function() {
        var argIndex = 0, applyArgs = [], self = this, lock = _lock(partialFn), result, i;
        for (i = 0; i < curriedLen; i++) {
          var arg = curriedArgs[i];
          if (isDefined(arg)) {
            applyArgs[i] = arg;
          } else {
            applyArgs[i] = arguments[argIndex++];
          }
        }
        for (i = argIndex; i < arguments.length; i++) {
          applyArgs.push(arguments[i]);
        }
        if (lock === null) {
          lock = curriedLen;
        }
        if (isNumber(lock)) {
          applyArgs.length = min(applyArgs.length, lock);
        }
        // If the bound "this" object is an instance of the partialed
        // function, then "new" was used, so preserve the prototype
        // so that constructor functions can also be partialed.
        if (self instanceof partialFn) {
          self = createInstanceFromPrototype(fn.prototype);
          result = fn.apply(self, applyArgs);
          // An explicit return value is allowed from constructors
          // as long as they are of "object" type, so return the
          // correct result here accordingly.
          return isObjectType(result) ? result : self;
        }
        return fn.apply(self, applyArgs);
      };
      _partial(partialFn, true);
      return partialFn;
    },

    
    'delay': function(fn, ms, args) {
      setDelay(fn, ms, fn, fn, args);
      return fn;
    },

    
    'every': function(fn, ms, args) {
      function execute () {
        // Set the delay first here, so that cancel
        // can be called within the executing function.
        setDelay(fn, ms, execute);
        fn.apply(fn, args);
      }
      setDelay(fn, ms, execute);
      return fn;
    }

  });

  

  defineStatic(sugarRegExp, {

    
    'escape': function(str) {
      return escapeRegExp(str);
    }

  });

  defineInstance(sugarRegExp, {

    
    'getFlags': function(r) {
      return getRegExpFlags(r);
    },

    
    'setFlags': function(r, flags) {
      return RegExp(r.source, flags);
    },

    
    'addFlags': function(r, flags) {
      return RegExp(r.source, getRegExpFlags(r, flags));
    },

    
    'removeFlags': function(r, flags) {
      var reg = allCharsReg(flags);
      return RegExp(r.source, getRegExpFlags(r).replace(reg, ''));
    }

  });

}).call(this);