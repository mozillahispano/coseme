CoSeMe.namespace('time', (function(){
  'use strict';

/* Quite a complicated way to do the same...
    // var d=datetime.datetime(*map(int, re.split('[^\d]', iso)[:-1]))
    var regex = /(?:[\d]+)/g;
    var matched = null;
    var elems = [];
    while (matched = regex.exec(iso)) {
      elems.push(matched[0]);
    }
    elems.pop();
    elems.unshift(null);
    var d = new (Date.bind.apply(Date, elems))();
    return d;
*/
	function parseIso(iso) {
    return new Date(iso);
  }

  function utcToLocal(dt) {
    return dt;
  }


  function utcTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  function datetimeToTimestamp(dt) {
    return Math.floor(dt.getTime() / 1000);
  }


  return {
    parseIso: parseIso,
    utcToLocal: utcToLocal,
    utcTimestamp: utcTimestamp,
    datetimeToTimestamp: datetimeToTimestamp
  };
}()));
