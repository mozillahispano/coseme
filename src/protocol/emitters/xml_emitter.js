
CoSeMe.namespace('protocol.emitters', (function(){
  'use strict';

  function XML(tree) {
    this._tree = tree;
  }

  XML.prototype.getRepresentation = function() {
    var tree = this._tree;

    // Begin of the opening tag
    var repr = '<' + tree.tag;

    // Attributes
    var attributes = tree.attributes;
    if (typeof attributes === 'object') {
      for (var name in attributes) if (attributes.hasOwnProperty(name)) {
        repr += (' ' + name + '="' + tree.getAttributeValue(name) + '"');
      }
    }

    // End of the opening tag
    repr += '>\n';

    // Data
    var data = tree.data;
    if (data) {
      repr += data;
    }

    // Children
    var children = tree.children;
    if (Array.isArray(children)) {
      for (var i = 0, l = children.length; i < l; i++) {
        repr += children[i].toString();
      }
    }

    // Closing tag
    repr += '</' + tree.tag + '>\n';

    return repr;
  };

  return XML;
}()));
