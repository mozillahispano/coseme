
CoSeMe.namespace('protocol', (function(){
  'use strict';

  var XMLEmitter = CoSeMe.protocol.emitters.XML;

  function Tree(tag, options) {
    options = options || {};
    this.tag = tag;
    this.children = options.children || [];
    this.attributes = options.attributes || {};
    this._data = options.data || null;
  }

  Tree.tagEquals = function(tree, name) {
    return tree && tree.tag === name;
  };

  Tree.require = function(tree, name) {
    if (!Tree.tagEquals(tree, name))
      throw new Error('Failed require. name: ' + name);
  };

  Tree.prototype.toString = function() {
    var emitter = new XMLEmitter(this);
    return emitter.getRepresentation();
  };

  Tree.prototype.getChild = function(identifier) {
    var found, child = null;
    var children = this.children;
    if (children && children.length > 0) {

      if (typeof identifier === 'number' && identifier < children.length) {
        child = children[identifier];
      }
      else if (typeof identifier === 'string') {
        for (var i = 0, l = children.length; i < l && !child; i++) {
          if (children[i].tag === identifier) {
            child = children[i];
          }
        }
      }
    }
    return child;
  };

  Object.defineProperty(Tree.prototype, "tag", {
    get: function() {
      var value = this._tag;
      if (value && value.hexdata) {
        value = CryptoJS.enc.Latin1.stringify(CryptoJS.enc.Hex.parse(value.hexdata));
      };
      return value;
    },
    set: function(tag) {
      this._tag = tag;
    }
  });

  Object.defineProperty(Tree.prototype, "data", {
    get: function() {
      var value = this._data;
      if (value && value.hexdata) {
        value = CryptoJS.enc.Latin1.stringify(CryptoJS.enc.Hex.parse(value.hexdata));
      };
      return value;
    },
    set: function(data) {
      this._data = data;
    }
  });

  Object.defineProperty(Tree.prototype, "hexData", {
    get: function() {
      return this._data && this._data.hexdata;
    }
  });

  Tree.prototype.getAttributeValue = function(attributeName, getHex) {
    if (!this.attributes)
      return null;

    var value = this.attributes[attributeName];
    if (value && value.hexdata) {
      value = getHex ? value.hexdata :
                       CryptoJS.enc.Latin1.stringify(CryptoJS.enc.Hex.parse(value.hexdata));
    };

    return typeof value !== 'undefined' ? value : null;
  };

  Tree.prototype.getAllChildren = function(tag) {
    var all = typeof tag === 'undefined';
    var filteredChildren = this.children.filter(function(child) {
      return all || child.tag === tag;
    });
    return filteredChildren;
  };

  return Tree;
}()));
