'use strict';

const assert = require('node:assert');
const { DEVICE_IDS, getDevice, getDeviceRanges, getDefaultChannelName } = require('../../build/lib/devices');
const { DATAPOINTS } = require('../../build/lib/converter');

describe('devices', () => {
    it('every datapoint has a device', () => {
        const withoutDevice = Object.keys(DATAPOINTS).filter(dp => !getDevice(parseInt(dp, 10)));
        assert.deepStrictEqual(withoutDevice, []);
    });

    it('getDevice() and getDeviceRanges() describe the same datapoints', () => {
        const inRange = {};
        for (const dev of DEVICE_IDS) {
            for (const range of getDeviceRanges(dev)) {
                assert.ok(range.lsb <= range.msb, `${dev}: ${JSON.stringify(range)}`);
                for (let dp = range.lsb; dp <= range.msb; dp++) {
                    assert.strictEqual(inRange[dp], undefined, `DP ${dp} is in ${inRange[dp]} and ${dev}`);
                    inRange[dp] = dev;
                }
            }
        }
        for (const dp of Object.keys(DATAPOINTS)) {
            assert.strictEqual(inRange[dp], getDevice(parseInt(dp, 10)), `DP ${dp}`);
        }
        for (const dp of Object.keys(inRange)) {
            assert.ok(DATAPOINTS[dp], `DP ${dp} is in a range, but not in datapoints.json`);
        }
    });

    it('maps the datapoints that were missing before', () => {
        assert.strictEqual(getDevice(211), 'km1_t');
        assert.strictEqual(getDevice(365), 'hg2_t');
        assert.strictEqual(getDevice(372), 'bm1_t');
    });

    it('has default channel names', () => {
        assert.strictEqual(getDefaultChannelName('hg1_t'), 'Heizgerät 1');
        assert.strictEqual(getDefaultChannelName('bm2_t'), 'Bediengerät 2');
        assert.strictEqual(getDefaultChannelName('mm3_t'), 'Mischermodul 3');
        assert.strictEqual(getDefaultChannelName('km1_t'), 'Kaskadenmodul');
        assert.strictEqual(getDefaultChannelName('sm1_t'), 'Solarmodul');
        assert.strictEqual(getDefaultChannelName('cwl_t'), 'Comfort-Wohnungs-Lüftung');
        assert.strictEqual(getDefaultChannelName('unknown'), 'Unbekannte Datenpunkte');
    });

    it('every datapoint has all required fields', () => {
        for (const [dp, data] of Object.entries(DATAPOINTS)) {
            for (const field of ['name', 'type', 'rw', 'read', 'write', 'commonType']) {
                assert.notStrictEqual(data[field], undefined, `DP ${dp}: ${field} is missing`);
            }
            if (data.rw === 'rw' && data.commonType === 'number') {
                assert.strictEqual(typeof data.min, 'number', `DP ${dp}: min`);
                assert.strictEqual(typeof data.max, 'number', `DP ${dp}: max`);
            }
        }
    });
});
