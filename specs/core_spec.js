
describe('CoSeMe core', function() {

  describe('the `namespace()` utility', function() {

    var global, any = jasmine.any;
    beforeEach(function() {
      global = { namespace: CoSeMe.namespace };
    });

    it('allows a Java-like namespace path', function() {
      var target = {};
      global.namespace('a.b', target);
      expect(global.a).toEqual(any(Object));
      expect(global.a.b).toEqual(any(Object));
    });

    it('returns the created namespace', function() {
      var ns = global.namespace('a.b', {});
      expect(ns).toEqual(global.a.b);
    });

    it('adds members of the object to a new namespace', function() {
      var target = { a: 1, b: 2 };
      global.namespace('a.b', target);
      expect(global.a.b).toEqual(target);
    });

    it('allows to extend an already populated namespace with new members',
    function() {
      var target = { a: 1, b: 2 };
      global.namespace('a.b', target);
      expect(global.a.b).toEqual(target);
      var xtarget = { a: 1, b: 2, c: 3 };
      global.namespace('a.b', { c: 3 });
      expect(global.a.b).toEqual(xtarget);
    });

    it('allows named constructors to be directly added into a namespace',
    function() {
      var target = {};
      var cons = function cons() {};
      global.namespace('a.b', target);
      var ns = global.namespace('a.b', cons);
      expect(ns.cons).toBe(cons);
    });

    it('fails if trying to add an unamed constructor', function() {
      function addUnamedConstructor() {
        var cons = function() {};
        global.namespace('a.b', cons);
      }
      expect(addUnamedConstructor).toThrow();
    });

    it('fails if trying to add other entity distinct than function or object',
    function() {
      function addOtherEntities() {
        global.namespace('a.b', 5);
      }
      expect(addOtherEntities).toThrow();
    });

  });

});
