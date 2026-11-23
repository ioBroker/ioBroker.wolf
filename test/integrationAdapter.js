'use strict';

const assert = require('node:assert');
const net = require('node:net');
const path = require('node:path');
const { tests } = require('@iobroker/testing');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

/** Connects like an ISM8i to the adapter. Retries until the server of the adapter is listening. */
async function connectIsm8i(port) {
    for (let i = 0; i < 50; i++) {
        try {
            return await new Promise((resolve, reject) => {
                const client = net.connect(port, '127.0.0.1', () => resolve(client));
                client.received = [];
                client.on('data', data => client.received.push(data.toString('hex')));
                client.once('error', reject);
            });
        } catch {
            await wait(200);
        }
    }
    throw new Error(`Cannot connect to the adapter on port ${port}`);
}

function getState(harness, id) {
    return new Promise((resolve, reject) =>
        harness.states.getState(id, (err, state) => (err ? reject(err) : resolve(state))),
    );
}

function getObject(harness, id) {
    return new Promise((resolve, reject) =>
        harness.objects.getObject(id, (err, obj) => (err ? reject(err) : resolve(obj))),
    );
}

async function waitForState(harness, id, check) {
    let state;
    for (let i = 0; i < 50; i++) {
        state = await getState(harness, id);
        if (state && check(state)) {
            return state;
        }
        await wait(200);
    }
    throw new Error(`State ${id} has not the expected value: ${JSON.stringify(state)}`);
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('ISM8i connection', getHarness => {
            it('creates objects from received telegrams and acknowledges them', async function () {
                this.timeout(60000);
                const harness = getHarness();
                const port = await getFreePort();
                await harness.changeAdapterConfig('wolf', { native: { port, bind: '127.0.0.1' } });
                await harness.startAdapterAndWait();

                const ism8i = await connectIsm8i(port);
                await waitForState(harness, 'wolf.0.info.connection', state => state.val === true);
                // the adapter requests all values after connecting
                await wait(500);
                assert.deepStrictEqual(ism8i.received, ['0620f080001604000000f0d0']);
                ism8i.received = [];

                // DP 11 "Status Speicherladepumpe" = 1, split over two TCP packets (#107),
                // followed by a telegram with DP 4 "Kesseltemperatur" = 21 °C and DP 9 "Status Brenner" = 1
                const dp11 = Buffer.from('0620f080001504000000f006000b0001000b030101', 'hex');
                const dp4and9 = Buffer.from('0620f080001b04000000f00600040002000403020c1a0009030101', 'hex');
                ism8i.write(dp11.subarray(0, 8));
                await wait(100);
                ism8i.write(Buffer.concat([dp11.subarray(8), dp4and9]));

                await waitForState(harness, 'wolf.0.hg1_t.11', state => state.val === 'On' && state.ack);
                await waitForState(harness, 'wolf.0.hg1_t.4', state => state.val === 21 && state.ack);
                await waitForState(harness, 'wolf.0.hg1_t.9', state => state.val === 'On' && state.ack);

                const channel = await getObject(harness, 'wolf.0.hg1_t');
                assert.strictEqual(channel.type, 'channel');
                assert.strictEqual(channel.common.name, 'Heizgerät 1');
                const obj = await getObject(harness, 'wolf.0.hg1_t.199');
                assert.strictEqual(obj.common.type, 'number');
                assert.strictEqual(obj.common.max, 90);

                // every telegram is acknowledged with SetDatapointValue.Res
                assert.strictEqual(
                    ism8i.received.join(''),
                    '0620f080001104000000f086000b000000' + '0620f080001104000000f0860004000000',
                );

                // writing a value sends a DatapointValue.Ind to the ISM8i
                ism8i.received = [];
                await new Promise((resolve, reject) =>
                    harness.states.setState('wolf.0.hg1_t.199', { val: 60, ack: false }, err =>
                        err ? reject(err) : resolve(),
                    ),
                );
                await waitForState(harness, 'wolf.0.hg1_t.199', state => state.val === 60 && state.ack);
                assert.strictEqual(ism8i.received.join('').slice(0, 40), '0620f080001604000000f0c100c7000100c70002');

                ism8i.destroy();
                await waitForState(harness, 'wolf.0.info.connection', state => state.val === false);
            });
        });
    },
});
