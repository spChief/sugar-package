// Extended type definitions for Sugar v2.0.5
// Project: https://sugarjs.com/
// Definitions by: Andrew Plummer <plummer.andrew@gmail.com>

/// <reference path="sugar.d.ts" />

interface ArrayConstructor {
  construct<T>(n: number, indexMapFn: (i: number) => T): T[];
  create<T>(obj?: number|ArrayLike<T>, clone?: boolean): T[];
}

interface Array<T> {
  add(item: T|T[], index?: number): T[];
  append(item: T|T[], index?: number): T[];
  at(index: number|number[], loop?: boolean): T;
  average<U>(map?: string|sugarjs.Array.mapFn<T, U>): number;
  clone(): T[];
  compact(all?: boolean): T[];
  count(search: T|sugarjs.Array.searchFn<T>, context?: any): number;
  every(search: T|sugarjs.Array.searchFn<T>, context?: any): boolean;
  everyFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  everyFromIndex(startIndex: number, ...args: any[]): T;
  exclude(search: T|sugarjs.Array.searchFn<T>): T[];
  filter(search: T|sugarjs.Array.searchFn<T>, context?: any): T[];
  filterFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  filterFromIndex(startIndex: number, ...args: any[]): T;
  find(search: T|sugarjs.Array.searchFn<T>, context?: any): T;
  findFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  findFromIndex(startIndex: number, ...args: any[]): T;
  findIndex(search: T|sugarjs.Array.searchFn<T>, context?: any): number;
  findIndexFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  findIndexFromIndex(startIndex: number, ...args: any[]): T;
  first(num?: number): T;
  flatten(limit?: number): T[];
  forEachFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  forEachFromIndex(startIndex: number, ...args: any[]): T;
  from(index: number): T[];
  groupBy<U>(map: string|sugarjs.Array.mapFn<T, U>, groupFn?: (arr: T[], key: string, obj: Object) => void): Object;
  inGroups(num: number, padding?: any): T[];
  inGroupsOf(num: number, padding?: any): T[];
  insert(item: T|T[], index?: number): T[];
  intersect(arr: T[]): T[];
  isEmpty(): boolean;
  isEqual(arr: T[]): boolean;
  last(num?: number): T;
  least<U>(all?: boolean, map?: string|sugarjs.Array.mapFn<T, U>): T[];
  least<U>(map?: string|sugarjs.Array.mapFn<T, U>): T[];
  map<U>(map: string|sugarjs.Array.mapFn<T, U>, context?: any): U[];
  mapFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  mapFromIndex(startIndex: number, ...args: any[]): T;
  max<U>(all?: boolean, map?: string|sugarjs.Array.mapFn<T, U>): T;
  max<U>(map?: string|sugarjs.Array.mapFn<T, U>): T;
  median<U>(map?: string|sugarjs.Array.mapFn<T, U>): number;
  min<U>(all?: boolean, map?: string|sugarjs.Array.mapFn<T, U>): T;
  min<U>(map?: string|sugarjs.Array.mapFn<T, U>): T;
  most<U>(all?: boolean, map?: string|sugarjs.Array.mapFn<T, U>): T[];
  most<U>(map?: string|sugarjs.Array.mapFn<T, U>): T[];
  none(search: T|sugarjs.Array.searchFn<T>, context?: any): boolean;
  reduceFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  reduceFromIndex(startIndex: number, ...args: any[]): T;
  reduceRightFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  reduceRightFromIndex(startIndex: number, ...args: any[]): T;
  remove(search: T|sugarjs.Array.searchFn<T>): T[];
  removeAt(start: number, end?: number): T[];
  sample(num?: number, remove?: boolean): T;
  shuffle(): T[];
  some(search: T|sugarjs.Array.searchFn<T>, context?: any): boolean;
  someFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  someFromIndex(startIndex: number, ...args: any[]): T;
  sortBy<U>(map?: string|sugarjs.Array.sortMapFn<T, U>, desc?: boolean): T[];
  subtract(item: T|T[]): T[];
  sum<U>(map?: string|sugarjs.Array.mapFn<T, U>): number;
  to(index: number): T[];
  union(arr: T[]): T[];
  unique<U>(map?: string|sugarjs.Array.mapFn<T, U>): T[];
  zip(...args: any[]): T[];
}

interface DateConstructor {
  addLocale(localeCode: string, def: Object): sugarjs.Locale;
  create(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  getAllLocaleCodes(): string[];
  getAllLocales(): Array<sugarjs.Locale>;
  getLocale(localeCode?: string): sugarjs.Locale;
  range(start?: string|Date, end?: string|Date): sugarjs.Range;
  removeLocale(localeCode: string): sugarjs.Locale;
  setLocale(localeCode: string): sugarjs.Locale;
}

interface Date {
  addDays(n: number, reset?: boolean): Date;
  addHours(n: number, reset?: boolean): Date;
  addMilliseconds(n: number, reset?: boolean): Date;
  addMinutes(n: number, reset?: boolean): Date;
  addMonths(n: number, reset?: boolean): Date;
  addSeconds(n: number, reset?: boolean): Date;
  addWeeks(n: number, reset?: boolean): Date;
  addYears(n: number, reset?: boolean): Date;
  advance(set: string|Object, reset?: boolean): Date;
  advance(milliseconds: number): Date;
  advance(year: number, month: number, day?: number, hour?: number, minute?: number, second?: number, millliseconds?: undefined): Date;
  beginningOfDay(localeCode?: string): Date;
  beginningOfISOWeek(): Date;
  beginningOfMonth(localeCode?: string): Date;
  beginningOfWeek(localeCode?: string): Date;
  beginningOfYear(localeCode?: string): Date;
  clone(): Date;
  daysAgo(): number;
  daysFromNow(): number;
  daysInMonth(): number;
  daysSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  daysUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  endOfDay(localeCode?: string): Date;
  endOfISOWeek(): Date;
  endOfMonth(localeCode?: string): Date;
  endOfWeek(localeCode?: string): Date;
  endOfYear(localeCode?: string): Date;
  format(f?: string, localeCode?: string): string;
  full(localeCode?: string): string;
  get(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  getISOWeek(): number;
  getUTCOffset(iso?: boolean): string;
  getUTCWeekday(): number;
  getWeekday(): number;
  hoursAgo(): number;
  hoursFromNow(): number;
  hoursSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  hoursUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  is(d: string|number|Date, margin?: number): boolean;
  isAfter(d: string|number|Date, margin?: number): boolean;
  isBefore(d: string|number|Date, margin?: number): boolean;
  isBetween(d1: string|number|Date, d2: string|number|Date, margin?: number): boolean;
  isFriday(): boolean;
  isFuture(): boolean;
  isLastMonth(localeCode?: string): boolean;
  isLastWeek(localeCode?: string): boolean;
  isLastYear(localeCode?: string): boolean;
  isLeapYear(): boolean;
  isMonday(): boolean;
  isNextMonth(localeCode?: string): boolean;
  isNextWeek(localeCode?: string): boolean;
  isNextYear(localeCode?: string): boolean;
  isPast(): boolean;
  isSaturday(): boolean;
  isSunday(): boolean;
  isThisMonth(localeCode?: string): boolean;
  isThisWeek(localeCode?: string): boolean;
  isThisYear(localeCode?: string): boolean;
  isThursday(): boolean;
  isToday(): boolean;
  isTomorrow(): boolean;
  isTuesday(): boolean;
  isUTC(): boolean;
  isValid(): boolean;
  isWednesday(): boolean;
  isWeekday(): boolean;
  isWeekend(): boolean;
  isYesterday(): boolean;
  iso(): string;
  long(localeCode?: string): string;
  medium(localeCode?: string): string;
  millisecondsAgo(): number;
  millisecondsFromNow(): number;
  millisecondsSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  millisecondsUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  minutesAgo(): number;
  minutesFromNow(): number;
  minutesSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  minutesUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  monthsAgo(): number;
  monthsFromNow(): number;
  monthsSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  monthsUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  relative(localeCode?: string, relativeFn?: (num: number, unit: number, ms: number, loc: sugarjs.Locale) => string): string;
  relative(relativeFn?: (num: number, unit: number, ms: number, loc: sugarjs.Locale) => string): string;
  relativeTo(d: string|number|Date, localeCode?: string): string;
  reset(unit?: string, localeCode?: string): Date;
  rewind(set: string|Object, reset?: boolean): Date;
  rewind(milliseconds: number): Date;
  rewind(year: number, month: number, day?: number, hour?: number, minute?: number, second?: number, millliseconds?: undefined): Date;
  secondsAgo(): number;
  secondsFromNow(): number;
  secondsSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  secondsUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  set(set: Object, reset?: boolean): Date;
  set(milliseconds: number): Date;
  set(year: number, month: number, day?: number, hour?: number, minute?: number, second?: number, millliseconds?: undefined): Date;
  setISOWeek(num: number): void;
  setUTC(on?: boolean): Date;
  setWeekday(dow: number): void;
  short(localeCode?: string): string;
  weeksAgo(): number;
  weeksFromNow(): number;
  weeksSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  weeksUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  yearsAgo(): number;
  yearsFromNow(): number;
  yearsSince(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
  yearsUntil(d?: string|number|Date, options?: sugarjs.Date.DateCreateOptions): number;
}

interface Function {
  after(n: number): Function;
  cancel(): Function;
  debounce(ms?: number): Function;
  delay(ms?: number, ...args: any[]): Function;
  every(ms?: number, ...args: any[]): Function;
  lazy(ms?: number, immediate?: boolean, limit?: number): Function;
  lock(n?: number): Function;
  memoize(hashFn?: string|Function, limit?: number): Function;
  once(): Function;
  partial(...args: any[]): Function;
  throttle(ms?: number): Function;
}

interface NumberConstructor {
  random(n1?: number, n2?: number): number;
  range(start?: number, end?: number): sugarjs.Range;
}

interface Number {
  abbr(precision?: number): string;
  abs(): number;
  acos(): number;
  asin(): number;
  atan(): number;
  bytes(precision?: number, binary?: boolean, units?: string): string;
  cap(max?: number): number;
  ceil(precision?: number): number;
  chr(): string;
  clamp(start?: number, end?: number): number;
  cos(): number;
  day(): number;
  dayAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  dayAgo(): Date;
  dayBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  dayFromNow(): Date;
  days(): number;
  daysAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  daysAgo(): Date;
  daysBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  daysFromNow(): Date;
  downto<T>(num: number, step?: number, everyFn?: (el: T, i: number, r: sugarjs.Range) => void): T[];
  downto<T>(num: number, everyFn?: (el: T, i: number, r: sugarjs.Range) => void): T[];
  duration(localeCode?: string): string;
  exp(): number;
  floor(precision?: number): number;
  format(place?: number): string;
  hex(pad?: number): string;
  hour(): number;
  hourAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  hourAgo(): Date;
  hourBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  hourFromNow(): Date;
  hours(): number;
  hoursAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  hoursAgo(): Date;
  hoursBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  hoursFromNow(): Date;
  isEven(): boolean;
  isInteger(): boolean;
  isMultipleOf(num: number): boolean;
  isOdd(): boolean;
  log(base?: number): number;
  metric(precision?: number, units?: string): string;
  millisecond(): number;
  millisecondAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  millisecondAgo(): Date;
  millisecondBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  millisecondFromNow(): Date;
  milliseconds(): number;
  millisecondsAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  millisecondsAgo(): Date;
  millisecondsBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  millisecondsFromNow(): Date;
  minute(): number;
  minuteAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  minuteAgo(): Date;
  minuteBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  minuteFromNow(): Date;
  minutes(): number;
  minutesAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  minutesAgo(): Date;
  minutesBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  minutesFromNow(): Date;
  month(): number;
  monthAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  monthAgo(): Date;
  monthBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  monthFromNow(): Date;
  months(): number;
  monthsAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  monthsAgo(): Date;
  monthsBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  monthsFromNow(): Date;
  ordinalize(): string;
  pad(place?: number, sign?: boolean, base?: number): string;
  pow(): number;
  round(precision?: number): number;
  second(): number;
  secondAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  secondAgo(): Date;
  secondBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  secondFromNow(): Date;
  seconds(): number;
  secondsAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  secondsAgo(): Date;
  secondsBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  secondsFromNow(): Date;
  sin(): number;
  sqrt(): number;
  tan(): number;
  times<T>(indexMapFn: (i: number) => any): T;
  toNumber(): number;
  upto<T>(num: number, step?: number, everyFn?: (el: T, i: number, r: sugarjs.Range) => void): T[];
  upto<T>(num: number, everyFn?: (el: T, i: number, r: sugarjs.Range) => void): T[];
  week(): number;
  weekAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  weekAgo(): Date;
  weekBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  weekFromNow(): Date;
  weeks(): number;
  weeksAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  weeksAgo(): Date;
  weeksBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  weeksFromNow(): Date;
  year(): number;
  yearAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  yearAgo(): Date;
  yearBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  yearFromNow(): Date;
  years(): number;
  yearsAfter(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  yearsAgo(): Date;
  yearsBefore(d: string|number|Date, options?: sugarjs.Date.DateCreateOptions): Date;
  yearsFromNow(): Date;
}

interface ObjectConstructor {
  fromQueryString<T, U>(str: string, options?: sugarjs.Object.QueryStringParseOptions<T, U>): Object;
  add<T>(instance: Object, obj: Object, options?: sugarjs.Object.ObjectMergeOptions<T>): Object;
  addAll<T>(instance: Object, sources: Array<Object>, options?: sugarjs.Object.ObjectMergeOptions<T>): Object;
  average<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): number;
  clone(instance: Object, deep?: boolean): Object;
  count<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): number;
  defaults<T>(instance: Object, sources: Array<Object>, options?: sugarjs.Object.ObjectMergeOptions<T>): Object;
  every<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): boolean;
  exclude<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): Object;
  filter<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): T[];
  find<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): boolean;
  forEach<T>(instance: Object, eachFn: (val: T, key: string, obj: Object) => void): Object;
  get<T>(instance: Object, key: string, inherited?: boolean): T;
  has(instance: Object, key: string, inherited?: boolean): boolean;
  intersect(instance: Object, obj: Object): Object;
  invert(instance: Object, multi?: boolean): Object;
  isArguments(instance: Object): boolean;
  isArray(instance: any): instance is Array<any>;
  isBoolean(instance: any): instance is boolean;
  isDate(instance: any): instance is Date;
  isEmpty(instance: Object): boolean;
  isEqual(instance: Object, obj: Object): boolean;
  isError(instance: any): instance is Error;
  isFunction(instance: any): instance is Function;
  isMap(instance: any): instance is Map<any, any>;
  isNumber(instance: any): instance is number;
  isObject(instance: Object): boolean;
  isRegExp(instance: any): instance is RegExp;
  isSet(instance: any): instance is Set<any>;
  isString(instance: any): instance is string;
  keys<T>(instance: Object): T[];
  least<T, U>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn<T, U>): T;
  least<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): T;
  map<T, U>(instance: Object, map: string|sugarjs.Object.mapFn<T, U>): Object;
  max<T, U>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn<T, U>): T;
  max<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): T;
  median<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): number;
  merge<T>(instance: Object, source: Object, options?: sugarjs.Object.ObjectMergeOptions<T>): Object;
  mergeAll<T>(instance: Object, sources: Array<Object>, options?: sugarjs.Object.ObjectMergeOptions<T>): Object;
  min<T, U>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn<T, U>): T;
  min<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): T;
  most<T, U>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn<T, U>): T;
  most<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): T;
  none<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): boolean;
  reduce<T>(instance: Object, reduceFn: (acc: T, val: T, key: string, obj: Object) => void, init?: any): T;
  reject(instance: Object, find: string|RegExp|Array<string>|Object): Object;
  remove<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): Object;
  select(instance: Object, find: string|RegExp|Array<string>|Object): Object;
  set<T>(instance: Object, key: string, val: T): Object;
  size(instance: Object): number;
  some<T>(instance: Object, search: T|sugarjs.Object.searchFn<T>): boolean;
  subtract(instance: Object, obj: Object): Object;
  sum<T, U>(instance: Object, map?: string|sugarjs.Object.mapFn<T, U>): number;
  tap(instance: Object, tapFn: (obj: Object) => any): Object;
  toQueryString<T, U>(instance: Object, options?: sugarjs.Object.QueryStringOptions<T, U>): Object;
  values<T>(instance: Object): T[];
}

interface RegExpConstructor {
  escape(str?: string): string;
}

interface RegExp {
  addFlags(flags: string): RegExp;
  getFlags(): string;
  removeFlags(flags: string): RegExp;
  setFlags(flags: string): RegExp;
}

interface StringConstructor {
  range(start?: string, end?: string): sugarjs.Range;
}

interface String {
  at<T>(index: number|Array<number>, loop?: boolean): T;
  camelize(upper?: boolean): string;
  capitalize(lower?: boolean, all?: boolean): string;
  chars<T>(eachCharFn?: (char: string, i: number, arr: Array<string>) => void): T[];
  codes<T>(eachCodeFn?: (code: number, i: number, str: string) => void): T[];
  compact(): string;
  dasherize(): string;
  decodeBase64(): string;
  encodeBase64(): string;
  escapeHTML(): string;
  escapeURL(param?: boolean): string;
  first(n?: number): string;
  forEach<T>(search?: string|RegExp, eachFn?: (match: string, i: number, arr: Array<string>) => void): T[];
  forEach<T>(eachFn: (match: string, i: number, arr: Array<string>) => void): T[];
  format(...args: any[]): string;
  from(index?: number): string;
  hankaku(mode?: string): string;
  hasArabic(): boolean;
  hasCyrillic(): boolean;
  hasDevanagari(): boolean;
  hasGreek(): boolean;
  hasHan(): boolean;
  hasHangul(): boolean;
  hasHebrew(): boolean;
  hasHiragana(): boolean;
  hasKana(): boolean;
  hasKanji(): boolean;
  hasKatakana(): boolean;
  hasLatin(): boolean;
  hasThai(): boolean;
  hiragana(all?: boolean): string;
  humanize(): string;
  insert(str: string, index?: number): string;
  isArabic(): boolean;
  isBlank(): boolean;
  isCyrillic(): boolean;
  isDevanagari(): boolean;
  isEmpty(): boolean;
  isGreek(): boolean;
  isHan(): boolean;
  isHangul(): boolean;
  isHebrew(): boolean;
  isHiragana(): boolean;
  isKana(): boolean;
  isKanji(): boolean;
  isKatakana(): boolean;
  isLatin(): boolean;
  isThai(): boolean;
  katakana(): string;
  last(n?: number): string;
  lines<T>(eachLineFn?: (line: string, i: number, arr: Array<string>) => void): T[];
  pad(num: number, padding?: string): string;
  padLeft(num: number, padding?: string): string;
  padRight(num: number, padding?: string): string;
  parameterize(): string;
  pluralize(num?: number): string;
  remove(f: string|RegExp): string;
  removeAll(f: string|RegExp): string;
  removeTags(tag?: string, replace?: string|sugarjs.String.replaceFn): string;
  replaceAll(f: string|RegExp, ...args: any[]): string;
  reverse(): string;
  shift<T>(n: number): T[];
  singularize(): string;
  spacify(): string;
  stripTags(tag?: string, replace?: string|sugarjs.String.replaceFn): string;
  titleize(): string;
  to(index?: number): string;
  toNumber(base?: number): number;
  trimLeft(): string;
  trimRight(): string;
  truncate(length: number, from?: string, ellipsis?: string): string;
  truncateOnWord(length: number, from?: string, ellipsis?: string): string;
  underscore(): string;
  unescapeHTML(): string;
  unescapeURL(partial?: boolean): string;
  words<T>(eachWordFn?: (word: string, i: number, arr: Array<string>) => void): T[];
  zenkaku(mode?: string): string;
}