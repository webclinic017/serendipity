import { expect } from 'chai';
import 'mocha';
import { Utils } from '../';

describe("Utils tests", () => {
    it("Normalized currency value", () => {
        expect(Utils.normalizeNumberString("$123,456.5")).to.equal("123456.5");
        expect(Utils.normalizeNumberString("-$123,456.5")).to.equal("-123456.5");
        expect(Utils.normalizeNumberString("-123456.5")).to.equal("-123456.5");
        expect(Utils.normalizeNumberString("-123,456.5")).to.equal("-123456.5");
        expect(Utils.normalizeNumberString("(123456.5)")).to.equal("-123456.5");
        expect(Utils.normalizeNumberString("(123456.5")).to.equal("123456.5");
    });
})
