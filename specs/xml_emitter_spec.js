
describe('XMLEmitter', function() {
  var XMLEmitter = CoSeMe.protocol.emitters.XML;

  describe('the `getRepresentation()` method', function() {

    function FakeTree(desc) {
      this.tag = desc.tag;
      this.attributes = desc.attributes;
      this.data = desc.data;
      this.children = desc.children;
    }

    FakeTree.prototype.getAttributeValue = function(name) {
      return this.attributes[name];
    }

    it('allows only-tag trees', function() {
      var tree = new FakeTree({ tag: 'test' });
      var emitter = new XMLEmitter(tree);
      expect(emitter.getRepresentation()).toBe('<test>\n</test>\n');
    });

    it('allows trees with attributes', function() {
      var tree = new FakeTree({ tag: 'test', attributes: { attr1: 1, attr2: 'a' } });
      var emitter = new XMLEmitter(tree);
      var repr = emitter.getRepresentation();
      expect(repr).toBe('<test attr1="1" attr2="a">\n</test>\n');
    });

    it('allows trees with data', function() {
      var tree = new FakeTree({ tag: 'test', data: 'sample' });
      var emitter = new XMLEmitter(tree);
      var repr = emitter.getRepresentation();
      expect(repr).toBe('<test>\nsample</test>\n');
    });

    it('allows trees with children', function() {
      var child1 = { toString: sinon.stub().returns('child1') };
      var child2 = { toString: sinon.stub().returns('child2') };
      var tree = new FakeTree({
        tag: 'test',
        children: [ child1, child2 ]
      });
      var emitter = new XMLEmitter(tree);
      var repr = emitter.getRepresentation();
      expect(child1.toString.calledOnce).toBe(true);
      expect(child2.toString.calledOnce).toBe(true);
      expect(repr).toBe('<test>\nchild1child2</test>\n');
    });

    it('allows trees with data and children', function() {
      var child1 = { toString: sinon.stub().returns('child1') };
      var child2 = { toString: sinon.stub().returns('child2') };
      var tree = new FakeTree({
        tag: 'test',
        data: 'sample',
        children: [ child1, child2 ]
      });
      var emitter = new XMLEmitter(tree);
      var repr = emitter.getRepresentation();
      expect(child1.toString.calledOnce).toBe(true);
      expect(child2.toString.calledOnce).toBe(true);
      expect(repr).toBe('<test>\nsamplechild1child2</test>\n');
    });


    it('allows trees with data and children and attributes', function() {
      var child1 = { toString: sinon.stub().returns('child1') };
      var child2 = { toString: sinon.stub().returns('child2') };
      var tree = new FakeTree({
        tag: 'test',
        attributes: { attr: 1 },
        data: 'sample',
        children: [ child1, child2 ]
      });
      var emitter = new XMLEmitter(tree);
      var repr = emitter.getRepresentation();
      expect(child1.toString.calledOnce).toBe(true);
      expect(child2.toString.calledOnce).toBe(true);
      expect(repr).toBe('<test attr="1">\nsamplechild1child2</test>\n');
    });

  });

});
