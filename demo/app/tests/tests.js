var Downloadmanager = require("nativescript-downloadmanager").Downloadmanager;
var downloadmanager = new Downloadmanager();

describe("greet function", function() {
    it("exists", function() {
        expect(downloadmanager.greet).toBeDefined();
    });

    it("returns a string", function() {
        expect(downloadmanager.greet()).toEqual("Hello, NS");
    });
});