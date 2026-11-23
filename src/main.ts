import * as utils from '@iobroker/adapter-core';
import { createServer, type Server, type Socket } from 'node:net';

import { Converter, DATAPOINTS, BOOLEAN_TYPES } from './lib/converter';
import { getDefaultChannelName, getDevice, getDeviceRanges, isAlwaysProcessed } from './lib/devices';
import { createAcknowledge, createWriteTelegram, GET_ALL, parseTelegram, splitTelegrams } from './lib/protocol';
import type { DeviceId, StateValue } from './lib/types';

/** Default port of the server, the ISM8i connects to it */
const DEFAULT_PORT = 12004;
/** Maximal polling interval in seconds (setInterval accepts up to 2^31-1 ms) */
const MAX_POLLING_INTERVAL = 2147482;

/** A state of a datapoint that exists at the expected path */
interface KnownDatapoint {
    /** full ID of the state */
    id: string;
    /** last value received from the ISM8i */
    value?: StateValue;
}

class WolfAdapter extends utils.Adapter {
    private server: Server | null = null;
    /** open connections from ISM8i devices */
    private connections: Socket[] = [];
    /** last value written to info.connection */
    private ismConnected: boolean | null = null;
    private pollingInterval: ioBroker.Interval | undefined = undefined;
    private converter = new Converter({ boolStatus: false, boolBar: false, log: () => {} });
    /** states of datapoints that exist at the expected path, key is the datapoint ID */
    private readonly knownDatapoints: Record<number, KnownDatapoint> = {};
    /** channels that existed when the adapter started */
    private readonly existingChannels = new Set<string>();
    /** devices that reported "Störung = 1" on the first value: they do not exist */
    private readonly ignoredDevices: Partial<Record<DeviceId, boolean>> = {};
    /** Telegrams are processed one after another, so that objects are completely created before the next value arrives */
    private processing: Promise<void> = Promise.resolve();

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'wolf' });

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('unload', callback => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        if (await this.migrateConfig()) {
            // the instance is restarted with the new configuration
            return;
        }

        let pollingInterval = parseInt(String(this.config.polling_interval), 10);
        if (isNaN(pollingInterval) || pollingInterval < 0 || pollingInterval > MAX_POLLING_INTERVAL) {
            this.log.info('Invalid polling interval. Disable polling.');
            pollingInterval = 0;
        }
        this.config.polling_interval = pollingInterval;
        // older versions stored the checkbox as string
        this.config.bool_bar = this.config.bool_bar === true || this.config.bool_bar === 'true';

        this.converter = new Converter({
            boolStatus: !!this.config.bool_status,
            boolBar: this.config.bool_bar,
            log: message => this.log.debug(message),
        });

        await this.checkExistingObjects();

        // bm0_t is enabled, if one of the operating modules is enabled (the old configuration dialog did the same)
        const devices = this.config.devices;
        devices.bm0_t =
            devices.bm1_t === 'Auto' || devices.bm2_t === 'Auto' || devices.bm3_t === 'Auto' || devices.bm4_t === 'Auto'
                ? 'Auto'
                : 'off';

        for (const dev of Object.keys(devices)) {
            if (this.existingChannels.has(dev)) {
                if (devices[dev] === 'off') {
                    await this.delObjectAsync(dev, { recursive: true });
                } else {
                    await this.addChannel(dev);
                }
            }
        }

        this.updateConnectionState();
        this.startServer();

        await this.subscribeStatesAsync('*');
    }

    /**
     * Converts configurations of older versions. The old configuration dialog converted them when it was opened,
     * the JsonConfig dialog cannot do this.
     *
     * @returns true if the configuration was changed and the instance will be restarted
     */
    private async migrateConfig(): Promise<boolean> {
        const devices: Record<string, string> = { ...this.config.devices };
        const names: Record<string, string> = { ...this.config.names };
        let changed = false;

        // Fix wrong config from before 12.12.2022
        for (const i of [1, 2, 3]) {
            if (devices[`mm1${i}_t`] !== undefined) {
                devices[`mm${i}_t`] = devices[`mm1${i}_t`];
                delete devices[`mm1${i}_t`];
                changed = true;
            }
            if (names[`mm1${i}_n`] !== undefined) {
                names[`mm${i}_n`] = names[`mm1${i}_n`];
                delete names[`mm1${i}_n`];
                changed = true;
            }
        }

        // Remap devices from earlier names (without _t/_n postfix)
        for (const key of Object.keys(devices)) {
            if (!key.endsWith('_t')) {
                if (devices[`${key}_t`] === undefined) {
                    devices[`${key}_t`] = devices[key];
                }
                delete devices[key];
                changed = true;
            }
        }
        for (const key of Object.keys(names)) {
            if (!key.endsWith('_n')) {
                if (names[`${key}_n`] === undefined) {
                    names[`${key}_n`] = names[key];
                }
                delete names[key];
                changed = true;
            }
        }

        if (!changed) {
            return false;
        }
        const obj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
        if (!obj) {
            // use the converted configuration without saving it
            this.config.devices = devices as ioBroker.AdapterConfig['devices'];
            this.config.names = names;
            return false;
        }
        this.log.info('Configuration of an older version converted, restarting the instance');
        obj.native.devices = devices;
        obj.native.names = names;
        await this.setForeignObjectAsync(obj._id, obj);
        return true;
    }

    /** Registers the existing states and fixes objects created by older versions or with other settings */
    private async checkExistingObjects(): Promise<void> {
        const objects = await this.getForeignObjectsAsync(`${this.namespace}.*`);
        for (const [id, obj] of Object.entries(objects)) {
            this.existingChannels.add(id.split('.')[2]);

            const dp = id.split('.').pop()!;
            const datapoint = DATAPOINTS[dp];
            if (!datapoint || !obj || obj.type !== 'state') {
                continue;
            }

            // Only an object at the expected path counts as existing. Older versions created some
            // datapoints in other channels. Such an object must not block creating the object at the
            // expected path, otherwise values are written to a state without object (#96).
            const expectedId = `${this.namespace}.${getDevice(parseInt(dp, 10))}.${dp}`;
            if (id !== expectedId) {
                this.log.info(
                    `Object ${id} is obsolete and not updated any more, the value of datapoint ${dp} is now in ${expectedId}. You can delete ${id}.`,
                );
                continue;
            }
            this.knownDatapoints[parseInt(dp, 10)] = { id };

            if (!obj.common) {
                continue;
            }
            let changed = false;
            const common = obj.common as ioBroker.StateCommon;
            const commonType = this.converter.getCommonType(dp);

            // Fix type if "status as boolean" was changed
            if (BOOLEAN_TYPES.includes(datapoint.type) && common.type !== commonType) {
                this.log.debug(`Update type of ${id} from ${common.type} to ${commonType}`);
                common.type = commonType;
                changed = true;
            }

            if (!datapoint.rw.includes('w')) {
                // Remove min/max from read-only states
                if (common.min !== undefined || common.max !== undefined) {
                    delete common.min;
                    delete common.max;
                    changed = true;
                }
            } else if (commonType === 'number' && (common.min !== datapoint.min || common.max !== datapoint.max)) {
                // Update min/max of writable states to the current limits
                this.log.debug(`Update min/max of ${id} to ${datapoint.min}..${datapoint.max}`);
                common.min = datapoint.min;
                common.max = datapoint.max;
                changed = true;
            }

            if (changed) {
                await this.setForeignObjectAsync(id, obj);
            }
        }
    }

    private onUnload(callback: () => void): void {
        try {
            if (this.pollingInterval) {
                this.clearInterval(this.pollingInterval);
                this.pollingInterval = undefined;
            }
            if (this.ismConnected) {
                void this.setState('info.connection', false, true).catch(() => {});
            }
            for (const sock of this.connections) {
                sock.destroy();
            }
            this.connections = [];
            if (this.server) {
                this.server.close(() => callback());
                this.server = null;
                return;
            }
        } catch {
            // ignore
        }
        callback();
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack || !id) {
            return;
        }
        const dp = parseInt(id.split('.').pop()!, 10);
        const datapoint = DATAPOINTS[dp];
        if (!datapoint) {
            return;
        }

        if (datapoint.rw === 'r') {
            this.log.error(`${id} is only readable`);
            // restore the last value received from the ISM8i
            const known = this.knownDatapoints[dp];
            if (known?.id === id && known.value !== undefined) {
                this.setState(id, known.value, true).catch(e =>
                    this.log.error(`Cannot set state ${id}: ${(e as Error).message}`),
                );
            }
            return;
        }

        if (state.val === null || state.val === undefined) {
            this.log.error(`Can't encode DP (no value) : ${dp} - type: ${datapoint.type}`);
            return;
        }
        let encoded: { buffer: Buffer; value: StateValue };
        try {
            encoded = this.converter.encode(state.val, dp);
        } catch (e) {
            this.log.error(
                `Can't encode DP (${(e as Error).message}) : ${dp} - data: ${String(state.val)} - type: ${datapoint.type}`,
            );
            return;
        }
        const telegram = createWriteTelegram(dp, encoded.buffer);

        const sockets = this.getConnections();
        if (!sockets.length) {
            this.log.warn(`Cannot write ${id}: ISM8i is not connected`);
            return;
        }
        sockets.forEach(sock => sock.write(telegram));
        this.log.debug(`send ${telegram.toString('hex')}`);
        this.setState(id, encoded.value, true).catch(e =>
            this.log.error(`Cannot set state ${id}: ${(e as Error).message}`),
        );
    }

    /** Returns the open connections to the ISM8i */
    private getConnections(): Socket[] {
        return this.connections.filter(sock => !sock.destroyed);
    }

    private updateConnectionState(): void {
        const connected = this.getConnections().length > 0;
        if (this.ismConnected !== connected) {
            this.ismConnected = connected;
            this.setState('info.connection', connected, true).catch(e =>
                this.log.error(`Cannot set info.connection: ${(e as Error).message}`),
            );
        }
    }

    private initPolling(): void {
        if (this.pollingInterval) {
            this.clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
        const interval = this.config.polling_interval as number;
        if (!interval) {
            return;
        }

        this.pollingInterval = this.setInterval(() => {
            const sockets = this.getConnections();
            if (!sockets.length) {
                this.log.debug('Polling skipped: ISM8i is not connected');
                return;
            }
            sockets.forEach(sock => sock.write(GET_ALL));
        }, interval * 1000);
    }

    private async addChannel(dev: string): Promise<void> {
        const groupName = this.config.names[dev.replace('_t', '_n')] || getDefaultChannelName(dev);
        this.log.debug(`Add Channel ${dev} : ${groupName}`);
        await this.extendObjectAsync(dev, {
            type: 'channel',
            common: {
                name: groupName,
            },
            native: {},
        });
    }

    /** Creates the channel and all states of the device of a datapoint */
    private async addDevice(dp: number): Promise<boolean> {
        const dev = getDevice(dp);
        if (!dev) {
            return false;
        }
        await this.addChannel(dev);

        for (const range of getDeviceRanges(dev)) {
            for (let idx = range.lsb; idx <= range.msb; idx++) {
                if (this.knownDatapoints[idx]) {
                    continue;
                }
                this.log.debug(`Add objects for ${dev}.${idx}`);
                const datapoint = DATAPOINTS[idx];
                if (!datapoint) {
                    this.log.warn(`No data for ${dev}.${idx}`);
                    continue;
                }
                const commonType = this.converter.getCommonType(idx);
                this.knownDatapoints[idx] = { id: `${this.namespace}.${dev}.${idx}` };
                const common: ioBroker.StateCommon = {
                    name: datapoint.name,
                    role: datapoint.type.replace('DPT_', '').toLowerCase(),
                    type: commonType,
                    read: datapoint.read,
                    write: datapoint.write,
                    unit: this.converter.getUnit(idx),
                };
                // min/max only for writable states, the values sent by the device are not limited
                if (commonType === 'number' && datapoint.rw.includes('w')) {
                    common.min = datapoint.min;
                    common.max = datapoint.max;
                }
                await this.extendObjectAsync(`${dev}.${idx}`, {
                    type: 'state',
                    common,
                    native: {
                        rw: datapoint.rw,
                    },
                });
            }
        }
        return true;
    }

    private setDatapointState(dp: number, value: Buffer, device: string | null, telegram: Buffer): void {
        const datapoint = DATAPOINTS[dp];
        let val: StateValue;
        try {
            val = this.converter.decode(dp, value);
        } catch {
            this.log.error(
                `Can't parse DP : ${dp}, type ${datapoint.type} - data: ${telegram.toString('hex')} - length: ${telegram.length}`,
            );
            this.log.debug(
                `Incoming Device: ${device}, Datapoint: ${dp}, Datapoint_name: ${datapoint.name}, Datapoint_type: ${datapoint.type}, Data: ${telegram.toString('hex')}, Length: ${telegram.length}`,
            );
            return;
        }
        this.log.debug(`Set Value for ${device}.${dp}.${datapoint.name}: ${val}`);
        this.setState(`${device}.${dp}`, val, true).catch(e =>
            this.log.error(`Cannot set state ${device}.${dp}: ${(e as Error).message}`),
        );
        this.knownDatapoints[dp].value = val;
    }

    private async processDatapoint(dp: number, value: Buffer, telegram: Buffer): Promise<void> {
        const datapoint = DATAPOINTS[dp];
        if (!datapoint) {
            this.log.debug(`Unknown datapoint ${dp} - data: ${telegram.toString('hex')}`);
            return;
        }
        if (!value.length) {
            this.log.debug(
                `Skip DP ${dp} without value - data: ${telegram.toString('hex')} - length: ${telegram.length}`,
            );
            return;
        }

        const device = getDevice(dp);
        this.log.debug(`Data for ${device} : ${dp}`);
        if ((device && this.config.devices[device] === 'Auto') || isAlwaysProcessed(dp)) {
            if (this.knownDatapoints[dp]) {
                this.setDatapointState(dp, value, device, telegram);
                return;
            }
            if (device && datapoint.name === 'Störung') {
                // Intentionally: if the first value of "Störung" is 1, the device is treated as not existing
                if (value.readInt8(0) === 1) {
                    this.ignoredDevices[device] = true;
                    this.log.info(`heating ${device} do not exist`);
                } else {
                    delete this.ignoredDevices[device];
                }
            }

            if (!device || !this.ignoredDevices[device]) {
                if (await this.addDevice(dp)) {
                    this.log.debug(`create objects: ${dp}`);
                    this.setDatapointState(dp, value, device, telegram);
                }
            }
        } else if (device) {
            this.log.debug(`Device ${device} is disabled, datapoint ${dp} ignored`);
        } else {
            this.log.debug(`For datapoint ${dp} no device defined.`);
        }
    }

    private async processTelegram(sock: Socket, telegram: Buffer): Promise<void> {
        this.log.debug(`Received telegram from ${sock.remoteAddress}:${sock.remotePort}: ${telegram.toString('hex')}`);
        const parsed = parseTelegram(telegram, message => this.log.debug(message));
        if (!parsed) {
            this.log.debug(`Ignore telegram with service ${telegram.subarray(10, 12).toString('hex')}`);
            return;
        }

        const ack = createAcknowledge(parsed.startDp);
        this.log.debug(`Acknowledge ${ack.toString('hex')}`);
        sock.write(ack);

        for (const { dp, value } of parsed.datapoints) {
            await this.processDatapoint(dp, value, telegram);
        }
    }

    private startServer(): void {
        this.server = createServer(sock => this.onConnection(sock));
        this.server.on('error', err => this.log.error(`Cannot start server: ${err.toString()}`));
        this.server.listen(parseInt(String(this.config.port), 10) || DEFAULT_PORT, this.config.bind);
        this.log.debug(`Server listening on ${this.config.bind}:${this.config.port}`);
    }

    private onConnection(sock: Socket): void {
        const address = `${sock.remoteAddress}:${sock.remotePort}`;

        // The ISM8i opens a new connection if the old one is broken. The old connection is often
        // not closed properly (half-open), so it is closed here. Otherwise, writes go to a dead connection.
        for (const old of this.connections.filter(s => s.remoteAddress === sock.remoteAddress)) {
            this.log.info(
                `New connection from ${address}, close old connection from ${old.remoteAddress}:${old.remotePort}`,
            );
            this.connections.splice(this.connections.indexOf(old), 1);
            old.destroy();
        }
        this.connections.push(sock);
        this.log.info(`ISM8i connected from ${address}`);
        this.updateConnectionState();

        // detect dead connections, e.g. if the ISM8i lost power or the network was interrupted
        sock.setKeepAlive(true, 60000);

        let received: Buffer = Buffer.alloc(0);

        sock.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(err.code)) {
                this.log.info(`Connection from ${address} lost: ${err.code}`);
            } else {
                this.log.warn(`Socket error from ${address}: ${err.message}`);
            }
        });

        sock.on('data', chunk => {
            this.log.debug(`Received Data from ${address}: ${chunk.toString('hex')}`);
            const { telegrams, rest } = splitTelegrams(Buffer.concat([received, chunk]), message =>
                this.log.debug(message),
            );
            received = rest;
            for (const telegram of telegrams) {
                this.processing = this.processing
                    .then(() => this.processTelegram(sock, telegram))
                    .catch(e =>
                        this.log.error(`Cannot process telegram ${telegram.toString('hex')}: ${(e as Error).message}`),
                    );
            }
        });

        // 'close' is emitted after 'end' and after 'error', so every closed connection is removed
        sock.on('close', () => {
            const pos = this.connections.indexOf(sock);
            if (pos !== -1) {
                this.connections.splice(pos, 1);
            }
            this.log.info(`Connection from ${address} closed`);
            this.updateConnectionState();
        });

        this.log.debug(`Requesting all values from ${address} (GetAll)`);
        sock.write(GET_ALL);

        this.initPolling();
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new WolfAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new WolfAdapter())();
}
