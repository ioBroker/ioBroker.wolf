'use strict';

const assert = require('node:assert');
const { splitTelegrams, parseTelegram, createAcknowledge, createWriteTelegram, GET_ALL } = require('../../build/lib/protocol');

const T = hex => Buffer.from(hex.replace(/\s/g, ''), 'hex');
const noLog = () => {};

// telegrams from the issues and the ISM8i manual
const DP10 = '0620f080001504000000f006000a0001000a030100';
const DP11 = '0620f080001504000000f006000b0001000b030101';
const DP12 = '0620f080001504000000f006000c0001000c030100';
// one telegram with 2 datapoints: DP 4 (2 bytes) + DP 9 (1 byte)
const MULTI = '0620f080001b04000000f00600040002000403020c1a0009030101';

/** Feeds the chunks like the socket does and returns all telegrams */
function receive(chunks) {
    let received = Buffer.alloc(0);
    const telegrams = [];
    for (const chunk of chunks) {
        const result = splitTelegrams(Buffer.concat([received, T(chunk)]), noLog);
        received = result.rest;
        telegrams.push(...result.telegrams.map(t => t.toString('hex')));
    }
    return { telegrams, rest: received.toString('hex') };
}

describe('protocol: splitTelegrams', () => {
    it('joins a telegram split over two chunks (#107)', () => {
        assert.deepStrictEqual(receive([DP10.slice(0, 20), DP10.slice(20)]), { telegrams: [DP10], rest: '' });
    });
    it('joins a split header', () => {
        assert.deepStrictEqual(receive([DP11.slice(0, 4), DP11.slice(4)]).telegrams, [DP11]);
    });
    it('splits several telegrams in one chunk and keeps an incomplete one', () => {
        assert.deepStrictEqual(receive([DP10 + DP11 + DP12 + DP10.slice(0, 30)]), {
            telegrams: [DP10, DP11, DP12],
            rest: DP10.slice(0, 30),
        });
    });
    it('handles byte-by-byte delivery', () => {
        assert.deepStrictEqual(receive((DP10 + DP11).match(/../g)).telegrams, [DP10, DP11]);
    });
    it('ignores data before the header', () => {
        assert.deepStrictEqual(receive([`ffff00${DP11}`]).telegrams, [DP11]);
    });
    it('skips a header with invalid frame size', () => {
        assert.deepStrictEqual(receive([`0620f0800005${DP11}`]).telegrams, [DP11]);
    });
});

describe('protocol: parseTelegram', () => {
    it('parses the example of the manual', () => {
        const parsed = parseTelegram(T('06 20 F0 80 00 15 04 00 00 00 F0 06 00 6E 00 01 00 6E 03 01 01'), noLog);
        assert.strictEqual(parsed.startDp, 110);
        assert.deepStrictEqual(
            parsed.datapoints.map(d => [d.dp, d.value.toString('hex')]),
            [[110, '01']],
        );
    });
    it('parses all datapoints of a telegram', () => {
        const parsed = parseTelegram(T(MULTI), noLog);
        assert.deepStrictEqual(
            parsed.datapoints.map(d => [d.dp, d.value.toString('hex')]),
            [
                [4, '0c1a'],
                [9, '01'],
            ],
        );
    });
    it('returns a datapoint without value (#124)', () => {
        const parsed = parseTelegram(T('0620f080001404000000f0060159000101590300'), noLog);
        assert.deepStrictEqual(
            parsed.datapoints.map(d => [d.dp, d.value.length]),
            [[345, 0]],
        );
    });
    it('stops at an incomplete datapoint', () => {
        const parsed = parseTelegram(T('0620f080001804000000f00600040002000403020c1a000903'), noLog);
        assert.deepStrictEqual(
            parsed.datapoints.map(d => d.dp),
            [4],
        );
    });
    it('ignores other services', () => {
        assert.strictEqual(parseTelegram(T('0620f080001104000000f0c1006e000000'), noLog), null);
    });
});

describe('protocol: telegrams to the ISM8i', () => {
    it('creates the acknowledgement of the manual', () => {
        assert.strictEqual(createAcknowledge(110).toString('hex'), '0620f080001104000000f086006e000000');
    });
    it('creates a new buffer for every acknowledgement', () => {
        const a = createAcknowledge(1);
        createAcknowledge(2);
        assert.strictEqual(a.readUInt16BE(12), 1);
    });
    it('creates GetAll', () => {
        assert.strictEqual(GET_ALL.toString('hex'), '0620f080001604000000f0d0');
    });
    it('creates a write telegram (DatapointValue.Ind)', () => {
        assert.strictEqual(
            createWriteTelegram(56, T('14e2')).toString('hex'),
            '0620f080001604000000f0c1003800010038000214e2',
        );
        assert.strictEqual(
            createWriteTelegram(156, T('0c1e00')).toString('hex'),
            '0620f080001704000000f0c1009c0001009c00030c1e00',
        );
    });
});
