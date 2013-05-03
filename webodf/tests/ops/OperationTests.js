/**
 * Copyright (C) 2013 KO GmbH <jos.van.den.oever@kogmbh.com>
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global runtime, core, gui, ops, odf, xmldom*/
runtime.loadClass("odf.Namespaces");
runtime.loadClass("xmldom.LSSerializer");

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
ops.OperationTests = function OperationTests(runner) {
    "use strict";
    var r = runner, t, domDocument = runtime.getWindow().document, testarea,
        tests;

    function serialize(element) {
        var serializer = new xmldom.LSSerializer();
        return serializer.writeToString(element, {});
    }

    function parseOperation(node) {
        var op = {},
            atts = node.attributes,
            att,
            n = atts.length,
            i;
        for (i = 0; i < n; i += 1) {
            att = atts.item(i);
            op[att.localName] = att.nodeValue;
        }
        return op;
    }
    function parseTest(node) {
        var before = node.firstElementChild,
            opsElement = before.nextElementSibling,
            after = opsElement.nextElementSibling,
            ops = [],
            test = {},
            op;
        runtime.assert(before.localName === "before", "Expected <before/>.");
        runtime.assert(opsElement.localName === "ops", "Expected <ops/>.");
        runtime.assert(after.localName === "after", "Expected <after/>.");
        op = opsElement.firstElementChild;
        while (op) {
            runtime.assert(op.localName === "op", "Expected <op/>.");
            ops.push(parseOperation(op));
            op = op.nextElementChild;
        }
        return {
            before: before,
            ops: ops,
            after: after
        };
    }

    function copyChildNodes(a, b) {
        while (b.firstChild) {
            b.removeChild(b.firstChild);
        }
        var n = a.firstChild;
        while (n) {
            if (a.ownerDocument === b.ownerDocument) {
                b.appendChild(n.cloneNode(true));
            } else {
                b.appendChild(b.ownerDocument.importNode(n, true));
            }
            n = n.nextSibling;
        }
    }

    function getOfficeTextNode(node) {
        var t = node.firstElementChild;
        while (t) {
            if (t.localName === "text") {
                return t;
            }
            t = t.nextElementChild;
        }
        return null;
    }

    function compareAttributes(a, b) {
        var aatts = a.attributes,
            n = aatts.length,
            i,
            att;
        if (n !== b.attributes.length) {
            return false;
        }
        for (i = 0; i < n; i += 1) {
            att = aatts.item(i);
            if (!b.hasAttributeNS(att.namespaceURI, att.localName)
                    || b.getAttributeNS(att.namespaceURI, att.localName) !== att.value) {
                return false;
            }
        }
        return true;
    }

    function compareNodes(a, b) {
        if (a.nodeType !== b.nodeType) {
            return false;
        }
        if (a.nodeType === 3) {
            return a.data === b.data;
        }
        runtime.assert(a.nodeType === 1, "Only textnodes and elements supported.");
        if (a.namespaceURI !== b.namespaceURI || a.localName !== b.localName) {
            return false;
        }
        if (!compareAttributes(a, b)) {
            return false;
        }
        var an = a.firstChild,
            bn = b.firstChild;
        while (an) {
            if (!bn) {
                return false;
            }
            if (!compareNodes(an, bn)) {
                return false;
            }
            an = an.nextSibling;
            bn = bn.nextSibling;
        }
        if (bn) {
            return false;
        }
        return true;
    }

    function runTest(test) {
        var text = t.odtDocument.getRootNode(),
            session = new ops.Session(t.odtDocument.getOdfCanvas()),
            factory = new ops.OperationFactory(session),
            i,
            textbefore = getOfficeTextNode(test.before),
            textafter = getOfficeTextNode(test.after);
        copyChildNodes(textbefore, text);
        for (i = 0; i < test.ops.length; i += 1) {
            session.enqueue(factory.create(test.ops[i]));
        }
        if (!compareNodes(textafter, text)) {
            t.text = serialize(text);
            t.after = serialize(textafter);
        } else {
            t.text = t.after = "OK";
        }
        r.shouldBe(t, "t.text", "t.after");
    }

    function makeTestIntoFunction(name, test) {
        var f = function () {
            runTest(test);
        };
        f.testName = name;
        return f;
    }

    function makeTestsIntoFunction(tests) {
        var functions = [], i;
        for (i in tests) {
            if (tests.hasOwnProperty(i)) {
                functions.push(makeTestIntoFunction(i, tests[i]));
            }
        }
        return functions;
    }

    function loadTests(url) {
        url = "/home/oever/work/webodf/webodf/webodf/tests/ops/" + url;
        var s = runtime.readFileSync(url, "utf-8"),
            xml = runtime.parseXML(s),
            n,
            testName,
            tests = {};
        n = xml.documentElement.firstElementChild;
        while (n) {
            testName = n.getAttribute("name");
            runtime.assert(!tests.hasOwnProperty(testName), "Test name is not unique.");
            tests[testName] = parseTest(n);
            n = n.nextElementSibling;
        }
        return tests;
    }

    this.setUp = function () {
        var odfContainer,
            odfcanvas,
            text,
            p;
        t = {};
        testarea = core.UnitTest.provideTestAreaDiv();
        odfcanvas = new odf.OdfCanvas(testarea);
        t.odfContainer = odfContainer = new odf.OdfContainer("", null);
        odfcanvas.setOdfContainer(odfContainer);
        t.odtDocument = new ops.OdtDocument(odfcanvas);
    };
    this.tearDown = function () {
        t.odfContainer.saveAs("out.odt", function () {});
        t = {};
        core.UnitTest.cleanupTestAreaDiv();
    };
    this.tests = function () {
        if (!tests) {
            tests = makeTestsIntoFunction(loadTests("operationtests.xml"));
        }
        return tests;
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
ops.OperationTests.prototype.description = function () {
    "use strict";
    return "Test the OdtCursor class.";
};
(function () {
    "use strict";
    return ops.OperationTests;
}());
