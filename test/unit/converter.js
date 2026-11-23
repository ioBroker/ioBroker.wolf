'use strict';

const assert = require('node:assert');
const { Converter, DATAPOINTS } = require('../../build/lib/converter');
const { decodeDPT9, decodeDPT10, decodeDPT11, encodeDPT7, encodeDPT9, encodeDPT11 } = require('../../build/lib/dpt');

const hex = b => b.toString('hex');
const T = h => Buffer.from(h, 'hex');

function create(options) {
    const logs = [];
    const converter = new Converter(Object.assign({ boolStatus: false, boolBar: false, log: m => logs.push(m) }, options));
    return { converter, logs };
}

describe('dpt', () => {
    it('DPT 9: example of the manual (-30 = 8A24)', () => {
        assert.strictEqual(hex(encodeDPT9(-30)), '8a24');
        assert.strictEqual(decodeDPT9(T('8a24')), -30);
    });
    it('DPT 9: round trip -273...1000', () => {
        for (let v = -273; v <= 1000; v += 0.5) {
            const back = Math.round(decodeDPT9(encodeDPT9(v)) * 100) / 100;
            assert.ok(Math.abs(back - v) <= Math.abs(v) * 0.002 + 0.01, `${v} -> ${back}`);
        }
    });
    it('DPT 9: exact for typical temperatures', () => {
        for (const v of [0, 20, 50, 65, 80, 82, 90, -4, 4, 0.5, -0.5, 10]) {
            assert.strictEqual(Math.round(decodeDPT9(encodeDPT9(v)) * 100) / 100, v);
        }
    });
    it('DPT 7 has 2 bytes', () => {
        assert.strictEqual(hex(encodeDPT7(0x1234)), '1234');
    });
    it('DPT 11 uses the day of the month', () => {
        assert.strictEqual(hex(encodeDPT11(new Date(2026, 10, 23))), '170b1a');
    });
});

describe('converter: decode', () => {
    const { converter, logs } = create();
    const D = (dp, h) => converter.decode(dp, T(h));

    it('switch, bool, enable, open/close as text', () => {
        assert.strictEqual(D(9, '01'), 'On');
        assert.strictEqual(D(9, '00'), 'Off');
        assert.strictEqual(D(168, '01'), 'true');
        assert.strictEqual(D(111, '00'), 'Disable');
        assert.strictEqual(D(12, '00'), 'Close');
    });
    it('switch as boolean with "Status as Boolean"', () => {
        const c = create({ boolStatus: true }).converter;
        assert.strictEqual(c.decode(9, T('01')), true);
        assert.strictEqual(c.decode(12, T('00')), false);
        assert.strictEqual(c.getCommonType(9), 'boolean');
        assert.strictEqual(c.getCommonType(4), 'number');
    });
    it('temperature', () => assert.strictEqual(D(4, '0c1a'), 21));
    it('pressure in Pa and in bar', () => {
        const pa = 150000;
        const buffer = encodeDPT9(pa);
        assert.strictEqual(converter.decode(13, buffer), Math.round(decodeDPT9(buffer) * 100) / 100);
        const c = create({ boolBar: true }).converter;
        assert.strictEqual(c.decode(13, buffer), 1.5);
        assert.strictEqual(c.getUnit(13), 'bar');
        assert.strictEqual(converter.getUnit(13), 'Pa');
    });
    it('scaling: 255 = 100 %, 128 = 50 %', () => {
        assert.strictEqual(D(3, 'ff'), 100);
        assert.strictEqual(D(3, '80'), 50);
    });
    it('355 devices: MM1, HG1, Solarmodul', () => assert.strictEqual(D(355, '2102'), 'Mischermodul 1, Heizgerät 1, Solarmodul'));
    it('355 devices: bit 15 does not hide MM1', () => assert.strictEqual(D(355, '8002'), 'Mischermodul 1'));
    it('355 devices: HG5 (bit 12)', () => assert.strictEqual(D(355, '1000'), 'Heizgerät 5'));
    it('356 devices: CWL, BM-2', () => assert.strictEqual(D(356, '0840'), 'CWL Excellent, BM-2 (0) / System'));
    it('251 heating circuits as bit mask', () => assert.strictEqual(D(251, '03'), 'Dir. Heizkreis, Mischerkreis 1'));
    it('358 hot water circuits as bit mask', () => assert.strictEqual(D(358, '05'), 'Dir. Warmwasser, Warmwasser 2'));
    it('372 Störcode is a number', () => assert.strictEqual(D(372, '2a'), 42));
    it('357 boiler types', () => {
        assert.strictEqual(D(357, '06'), 'CHA');
        assert.strictEqual(D(357, '00'), 'kein Heizgerät');
        assert.strictEqual(D(357, '14'), '20');
    });
    it('Betriebsart', () => {
        assert.strictEqual(D(2, '07'), 'GLT / Test');
        assert.strictEqual(D(2, '01'), 'Heat');
        assert.strictEqual(D(177, '02'), 'Morning Warmup');
        assert.strictEqual(D(177, '07'), 'Test');
        assert.strictEqual(D(177, '63'), '99');
    });
    it('Programmwahl', () => {
        assert.strictEqual(D(57, '00'), 'Automatikbetrieb');
        assert.strictEqual(D(57, '02'), 'Standby');
        assert.strictEqual(D(57, '04'), 'Permanent Kühlen');
        assert.strictEqual(D(58, '04'), 'Standby');
        assert.strictEqual(D(58, '01'), '1');
        assert.strictEqual(D(149, '03'), 'Reduzierte Lüftung');
    });
    it('date and time are strings', () => {
        assert.strictEqual(D(154, '170b1a'), decodeDPT11(T('170b1a')));
        assert.strictEqual(typeof D(156, '0c1e00'), 'string');
    });
    it('every datapoint decodes a sample value with the right type', () => {
        for (const [dp, data] of Object.entries(DATAPOINTS)) {
            const value = converter.decode(parseInt(dp, 10), T('01020304'));
            assert.ok(['string', 'number', 'boolean'].includes(typeof value), `${dp} ${data.type}: ${typeof value}`);
            if (data.commonType === 'number') {
                assert.strictEqual(typeof value, 'number', `${dp} ${data.type} must be a number`);
            }
        }
    });
    it('logs unknown values only at debug level', () => {
        assert.ok(logs.length > 0);
    });
});

describe('converter: encode', () => {
    const { converter } = create();
    const E = (val, dp) => {
        const { buffer, value } = converter.encode(val, dp);
        return [hex(buffer), value];
    };

    it('Warmwassersolltemperatur 20...80 °C', () => {
        assert.deepStrictEqual(E(50, 56), ['14e2', 50]);
        assert.deepStrictEqual(E('55', 56)[1], 55);
        assert.deepStrictEqual(E(90, 56)[1], 80);
        assert.deepStrictEqual(E(10, 56)[1], 20);
        assert.throws(() => E('abc', 56), /Invalid number/);
    });
    it('Kesselsolltemperaturvorgabe above 81.9 °C', () => {
        assert.deepStrictEqual(E(90, 199)[1], 90);
        assert.strictEqual(Math.round(decodeDPT9(converter.encode(90, 199).buffer)), 90);
        assert.deepStrictEqual(E(85.4, 199)[1], 85);
    });
    it('Sammlersolltemperaturvorgabe can be written', () => {
        assert.deepStrictEqual(E(60, 210)[1], 60);
        assert.deepStrictEqual(E(200, 210)[1], 90);
    });
    it('Sollwertkorrektur -4...4 K in 0.5 K steps', () => {
        assert.deepStrictEqual(E(-5, 65)[1], -4);
        assert.deepStrictEqual(E(1.3, 65), [hex(encodeDPT9(1.5)), 1.5]);
    });
    it('Sparfaktor 0...10 K', () => {
        assert.deepStrictEqual(E(11, 66)[1], 10);
        assert.deepStrictEqual(E(2.5, 66)[1], 2.5);
    });
    it('Leistungsvorgabe in percent', () => {
        assert.deepStrictEqual(E(50, 198), ['80', 50]);
        assert.deepStrictEqual(E(100, 198), ['ff', 100]);
        assert.deepStrictEqual(E(150, 209), ['ff', 100]);
        assert.deepStrictEqual(E(0, 198), ['00', 0]);
        for (let p = 0; p <= 100; p++) {
            assert.strictEqual(E(p, 198)[1], p);
        }
    });
    it('Programmwahl Heizkreis/Mischer (numbering of the Wolf control unit)', () => {
        assert.deepStrictEqual(E(0, 57), ['02', 'Standby']);
        assert.deepStrictEqual(E(1, 57), ['00', 'Automatikbetrieb']);
        assert.deepStrictEqual(E('2', 70), ['01', 'Heizbetrieb']);
        assert.deepStrictEqual(E('Sparbetrieb', 57), ['03', 'Sparbetrieb']);
        assert.throws(() => E(7, 57), /Invalid value/);
        assert.throws(() => E('', 57), /Invalid value/);
    });
    it('Programmwahl Warmwasser (numbering of the Wolf control unit)', () => {
        assert.deepStrictEqual(E(0, 58), ['04', 'Standby']);
        assert.deepStrictEqual(E(1, 58), ['00', 'Automatikbetrieb']);
        assert.deepStrictEqual(E('Dauerbetrieb', 71), ['02', 'Dauerbetrieb']);
        assert.throws(() => E(4, 58), /Invalid value/);
    });
    it('Programmwahl CWL', () => {
        assert.deepStrictEqual(E(3, 149), ['03', 'Reduzierte Lüftung']);
        assert.deepStrictEqual(E('Nennlüftung', 149), ['01', 'Nennlüftung']);
        assert.throws(() => E(2, 149), /Invalid value/);
    });
    it('switch', () => {
        assert.deepStrictEqual(E('On', 59), ['01', 'On']);
        assert.deepStrictEqual(E(false, 59), ['00', 'Off']);
        assert.deepStrictEqual(E(1, 211), ['01', 'On']);
        assert.deepStrictEqual(create({ boolStatus: true }).converter.encode(true, 59).value, true);
    });
    it('date', () => {
        const [buffer, value] = E('2026-11-23', 154);
        assert.strictEqual(buffer, '170b1a');
        assert.strictEqual(value, decodeDPT11(T('170b1a')));
        assert.strictEqual(E('24.12.2026', 155)[0], '180c1a');
        assert.strictEqual(E(decodeDPT11(T('170b1a')), 154)[0], '170b1a');
        assert.throws(() => E('foo', 154), /Invalid date/);
    });
    it('time', () => {
        const [buffer, value] = E('12:30', 156);
        assert.strictEqual(buffer, '0c1e00');
        assert.strictEqual(typeof value, 'string');
        assert.strictEqual(E(decodeDPT10(T('0c1e00')), 157)[0], '0c1e00');
        assert.throws(() => E('25:00', 156), /Invalid time/);
    });
    it('every writable datapoint can be encoded', () => {
        const samples = {
            DPT_Switch: 'On',
            DPT_Scaling: 50,
            DPT_Tempd: 1,
            DPT_Value_Temp: 50,
            DPT_HVACMode: 1,
            DPT_DHWMode: 1,
            DPT_Date: '2026-01-02',
            DPT_TimeOfDay: '06:15',
        };
        for (const [dp, data] of Object.entries(DATAPOINTS)) {
            if (data.rw !== 'rw') {
                continue;
            }
            const { buffer, value } = converter.encode(samples[data.type], parseInt(dp, 10));
            assert.ok(buffer.length, `${dp}: buffer`);
            assert.ok(['string', 'number', 'boolean'].includes(typeof value), `${dp}: ${typeof value}`);
        }
    });
    it('read-only datapoints cannot be encoded', () => {
        assert.throws(() => E(1, 4), /Encoding not supported/);
    });
});
