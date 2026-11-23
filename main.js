'use strict';

const net         = require('net');
const utils       = require('@iobroker/adapter-core');
const adapterName = require('./package.json').name.split('.').pop();

const dec         = new (require('./js/decoder.js'))();
const enc         = new (require('./js/encoder.js'))();
const datapoints  = require('./js/datapoints.json');

const ack_data = {
    old_devices: {},
    new_devices: []
};
const ignore   = {};
let pollingInterval = null;

const buffReq    = Buffer.from('0620F080001104000000F086006E000000', 'hex');
const buffGetAll = Buffer.from('0620F080001604000000F0D0', 'hex');
const splitter   = Buffer.from('0620F080', 'hex');

let adapter;

const BOOLEAN_TYPES = ['DPT_Switch', 'DPT_Enable', 'DPT_OpenClose', 'DPT_Bool'];

function getCommonType(dp) {
    if (adapter.config.bool_status && BOOLEAN_TYPES.includes(datapoints[dp].type)) {
        return 'boolean';
    }
    return datapoints[dp].commonType;
}

function initPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (adapter.config.polling_interval === 0) return;

    pollingInterval = setInterval(() => {
        const sockets = getConnections();
        if (!sockets.length) {
            adapter.log.debug('Polling skipped: ISM8i is not connected');
            return;
        }
        sockets.forEach(sock => sock.write(buffGetAll));
    }, adapter.config.polling_interval * 1000);
}

/** Returns the open connections to the ISM8i */
function getConnections() {
    return adapter._connections.filter(sock => !sock.destroyed);
}

function updateConnectionState() {
    const connected = getConnections().length > 0;
    if (adapter._connected !== connected) {
        adapter._connected = connected;
        adapter.setState('info.connection', connected, true)
            .catch(e => adapter.log.error(`Cannot set info.connection: ${e.message}`));
    }
}

function startAdapter(options) {
    options = options || {};
    options.name = adapterName;

    adapter = new utils.Adapter(options);

    adapter._connections = [];
    adapter._connected = null;

    adapter.on('ready', () => main());
    adapter.on('unload', cb => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        adapter._connected && adapter.setState('info.connection', false, true).catch(() => {});
        if (adapter._server) {
            try {
                adapter._server.close(cb);
                for (let i = 0; i < adapter._connections.length; i++) {
                    adapter._connections[i].destroy();
                }
            } catch (e) {
                cb && cb();
            }
        } else {
            cb && cb();
        }
    });

    adapter.on('stateChange', (id, state) => {
        //adapter.log.debug(`stateChange: ${id} ${JSON.stringify(state)}`);
        if (state && !state.ack && id) {
            const dp = parseInt(id.split('.').pop());
            if (!datapoints[dp]) return;

            if (datapoints[dp].rw === 'r') {
                adapter.log.error(`${id} is only readable`);
                // restore the last value received from the ISM8i
                const value = ack_data[dp] && ack_data[dp].id === id ? ack_data[dp].value : undefined;
                if (value !== undefined) {
                    adapter.setState(id, value, true)
                        .catch(e => adapter.log.error(`Cannot set state ${id}: ${e.message}`));
                }
            } else {
                let encoded;
                try {
                    encoded = encode(state.val, dp);
                } catch (e) {
                    adapter.log.error(`Can't encode DP (${e.message}) : ${dp} - data: ${state.val} - type: ${datapoints[dp].type}`);
                    return;
                }
                const telegram = createWriteTelegram(dp, encoded[0]);

                const sockets = getConnections();
                if (!sockets.length) {
                    adapter.log.warn(`Cannot write ${id}: ISM8i is not connected`);
                    return;
                }
                sockets.forEach(sock => sock.write(telegram));
                adapter.log.debug(`send ${telegram.toString('hex')}`);
                adapter.setState(id, encoded[1], true)
                    .catch(e => adapter.log.error(`Cannot set state ${id}: ${e.message}`));
            }
        }
    });

    return adapter;
}

function getDevice(dp) {
    dp = parseInt(dp, 10);
    if ((dp >= 1 && dp <= 13) || (dp >= 197 && dp <= 199) || (dp === 364)) {
        return 'hg1_t';
    } else if ((dp >= 14 && dp <= 26) || (dp >= 200 && dp <= 202) || (dp === 365)) {
        return 'hg2_t';
    } else if ((dp >= 27 && dp <= 39) || (dp >= 203 && dp <= 205) || (dp === 366)) {
        return 'hg3_t';
    } else if ((dp >= 40 && dp <= 52) || (dp >= 206 && dp <= 208) || (dp === 367)) {
        return 'hg4_t';
    } else if ((dp >= 53 && dp <= 66) || (dp === 194) || (dp === 368) || (dp >= 355 && dp <= 361) || (dp === 251) || (dp === 372)) {
        return 'bm1_t';
    } else if ((dp >= 67 && dp <= 79) || (dp === 369)) {
        return 'bm2_t';
    } else if ((dp >= 80 && dp <= 92) || (dp === 370)) {
        return 'bm3_t';
    } else if ((dp >= 93 && dp <= 105)|| (dp === 371)) {
        return 'bm4_t';
    } else if ((dp >= 106 && dp <= 113) || (dp >= 209 && dp <= 211)) {
        return 'km1_t';
    } else if (dp >= 114 && dp <= 120) {
        return 'mm1_t';
    } else if (dp >= 121 && dp <= 127) {
        return 'mm2_t';
    } else if (dp >= 128 && dp <= 134) {
        return 'mm3_t';
    } else if ((dp >= 135 && dp <= 147) || (dp >= 195 && dp <= 196)) {
        return 'sm1_t';
    } else if ((dp >= 148 && dp <= 175) || (dp >= 192 && dp <= 193)) {
        return 'cwl_t';
    } else if (dp >= 176 && dp <= 191) {
        return 'hg0_t';
    } else if (dp >= 336 && dp <= 354){
        return 'unknown';
    } else {
        return null;
    }
}

function getDeviceRages(id) {
    if (id === 'hg1_t') {
        return [{ 'lsb': 1, 'msb': 13 }, { 'lsb': 197, 'msb': 199 }, { 'lsb': 364, 'msb': 364 }];
    } else if (id === 'hg2_t') {
        return [{ 'lsb': 14, 'msb': 26 }, { 'lsb': 200, 'msb': 202 }, { 'lsb': 365, 'msb': 365 }];
    } else if (id === 'hg3_t') {
        return [{ 'lsb': 27, 'msb': 39}, { 'lsb': 203, 'msb': 205 }, { 'lsb': 366, 'msb': 366 }];
    } else if (id === 'hg4_t') {
        return [{ 'lsb': 40, 'msb': 52 }, { 'lsb': 206, 'msb': 208 }, { 'lsb': 367, 'msb': 367 }];
    } else if (id === 'bm1_t') {
        return [{ 'lsb': 53, 'msb': 66 }, { 'lsb': 194, 'msb': 194 }, { 'lsb': 251, 'msb': 251 }, { 'lsb': 355, 'msb': 361 }, { 'lsb': 368, 'msb': 368 }, { 'lsb': 372, 'msb': 372 }];
    } else if (id === 'bm2_t') {
        return [{ 'lsb': 67, 'msb': 79 }, { 'lsb': 369, 'msb': 369 }];
    } else if (id === 'bm3_t') {
        return [{ 'lsb': 80, 'msb': 92 }, { 'lsb': 370, 'msb': 370 }];
    } else if (id === 'bm4_t') {
        return [{ 'lsb': 93, 'msb': 105 }, { 'lsb': 371, 'msb': 371 }];
    } else if (id === 'km1_t') {
        return [{ 'lsb': 106, 'msb': 113 }, { 'lsb': 209, 'msb': 211 }];
    } else if (id === 'mm1_t') {
        return [{ 'lsb': 114, 'msb': 120 }];
    } else if (id === 'mm2_t') {
        return [{ 'lsb': 121, 'msb': 127 }];
    } else if (id === 'mm3_t') {
        return [{ 'lsb': 128, 'msb': 134 }];
    } else if (id === 'sm1_t') {
        return [{ 'lsb': 135, 'msb': 147 }, { 'lsb': 195, 'msb': 196 }];
    } else if (id === 'cwl_t') {
        return [{ 'lsb': 148, 'msb': 175 }, { 'lsb': 192, 'msb': 193 }];
    } else if (id === 'hg0_t') {
        return [{ 'lsb': 176, 'msb': 191 }];
    } else if (id === 'unknown') {
        return [{ 'lsb': 336, 'msb': 354 }];
    } else {
        return false;
    }

}

// Heizgerätetyp, DP 357, 359, 360, 361 (ISM8i manual, 8.7.9)
const BOILER_TYPES = {
    0: 'kein Heizgerät',
    1: 'CGB-2',
    2: 'MGK-2',
    3: 'TOB',
    4: 'BWL-1S',
    5: 'FGB',
    6: 'CHA',
    7: 'COB-2',
    8: 'CGB-2 38/55',
    9: 'CGB-2 38/55',
    10: 'TGB-2',
    11: 'TGB-2',
    12: 'CGB-2 75/100',
    13: 'CGB-2 75/100',
    14: 'FHA',
};
// bit -> name. DP 251: available heating/mixer circuits, DP 358: available hot water circuits (ISM8i manual, 8.7.6, 8.7.7)
const HEATING_CIRCUITS = ['Dir. Heizkreis', 'Mischerkreis 1', 'Mischerkreis 2', 'Mischerkreis 3', 'Mischerkreis 4', 'Mischerkreis 5', 'Mischerkreis 6', 'Mischerkreis 7'];
const HOT_WATER_CIRCUITS = ['Dir. Warmwasser', 'Warmwasser 1', 'Warmwasser 2', 'Warmwasser 3', 'Warmwasser 4', 'Warmwasser 5', 'Warmwasser 6', 'Warmwasser 7'];
// bit -> name. DP 355 and 356: available devices (ISM8i manual, 8.7.8)
const DEVICES_355 = {
    1: 'Mischermodul 1',
    2: 'Mischermodul 2',
    3: 'Mischermodul 3',
    4: 'Mischermodul 4',
    5: 'Mischermodul 5',
    6: 'Mischermodul 6',
    7: 'Mischermodul 7',
    8: 'Heizgerät 1',
    9: 'Heizgerät 2',
    10: 'Heizgerät 3',
    11: 'Heizgerät 4',
    12: 'Heizgerät 5',
    13: 'Solarmodul',
};
const DEVICES_356 = {
    6: 'CWL Excellent',
    9: 'Solarmodul 1',
    10: 'Solarmodul 2',
    11: 'BM-2 (0) / System',
};
// DPT_HVACContrMode (ISM8i manual, 8.6.10)
const HVAC_CONTR_MODES = {
    0: 'Auto',
    1: 'Heat',
    2: 'Morning Warmup',
    3: 'Cool',
    4: 'Night Purge',
    5: 'Precool',
    6: 'Off',
    7: 'Test',
    8: 'Emergency Heat',
    9: 'Fan Only',
    10: 'Free Cool',
    11: 'Ice',
    12: 'Maximum Heating Mode',
    13: 'Economic Heat/Cool Mode',
    14: 'Dehumidification',
    15: 'Calibration Mode',
    16: 'Emergency Cool Mode',
    17: 'Emergency Steam Mode',
    20: 'NoDem',
};

/**
 * Returns the names of the set bits, separated by comma
 *
 * @param {number} value
 * @param {Record<number, string> | string[]} names bit -> name, bits without name are ignored
 */
function decodeBitMask(value, names) {
    const result = [];
    for (let bit = 0; bit < 16; bit++) {
        if (value & (1 << bit) && names[bit]) {
            result.push(names[bit]);
        }
    }
    return result.join(', ');
}

function decode(type, data, dp) {
    let val;
    let _data;

    if (type === 'DPT_Switch') {
        val = data.readInt8(0);
        if (val === 0) {
            if (adapter.config.bool_status) {
                return false;
            } else {
                return 'Off';
            }

        } else {
            if (adapter.config.bool_status) {
                return true;
            } else {
                return 'On';
            }
        }
    } else if (type === 'DPT_Bool') {
        val = data.readInt8(0);
        if (val === 0) {
            if (adapter.config.bool_status) {
                return false;
            } else {
                return 'false';
            }
        } else {
            if (adapter.config.bool_status) {
                return true;
            } else {
                return 'true';
            }
        }
    } else if (type === 'DPT_Enable') {
        val = data.readInt8(0);
        if (val === 0) {
            if (adapter.config.bool_status) {
                return false;
            } else {
                return 'Disable';
            }
        } else {
            if (adapter.config.bool_status) {
                return true;
            } else {
                return 'Enable';
            }
        }
    } else if (type === 'DPT_OpenClose') {
        val = data.readInt8(0);
        if (val === 0) {
            if (adapter.config.bool_status) {
                return false;
            } else {
                return 'Close';
            }
        } else {
            if (adapter.config.bool_status) {
                return true;
            } else {
                return 'Open';
            }
        }
    } else if (type === 'DPT_Scaling') {
        // DPT 5.001: 0...255 = 0...100 % (ISM8i manual, 8.6.2)
        return Math.round(dec.decodeDPT5(data) * 100 / 255);
    } else if (type === 'DPT_Value_Temp' || type === 'DPT_Tempd' || type === 'DPT_Value_Pres' || type === 'DPT_Power' || type === 'DPT_Value_Volume_Flow') {
        if (adapter.config.bool_bar && type === 'DPT_Value_Pres') {
            return Math.round((dec.decodeDPT9(data) / 100000) * 100) / 100;
        } else {
            val = Math.round(dec.decodeDPT9(data) * 100) / 100;
            if (type === 'DPT_Power' && val > 999){
                return val / 1000 ;
            }
            return val ;
        }

    } else if (type === 'DPT_TimeOfDay') {
        return dec.decodeDPT10(data);
    } else if (type === 'DPT_Value_1_Ucount') {
        _data = dec.decodeDPT5(data);
        if (dp === 357 || dp === 359 || dp === 360 || dp === 361) {
            // Heizgerätetyp (ISM8i manual, 8.7.9)
            if (BOILER_TYPES[_data] !== undefined) {
                return BOILER_TYPES[_data];
            }
            adapter.log.debug(`Unknown boiler type ${_data} for DP ${dp}`);
            return String(_data);
        } else if (dp === 358) {
            // bit mask of the available hot water circuits
            return decodeBitMask(_data, HOT_WATER_CIRCUITS);
        } else if (dp === 251) {
            // bit mask of the available heating/mixer circuits
            return decodeBitMask(_data, HEATING_CIRCUITS);
        }
        return _data;
    } else if (type === 'DPT_Value_2_Ucount') {
        // bit masks of the available devices (ISM8i manual, 8.7.8)
        _data = data.readUInt16BE(0);
        if (dp === 355) {
            return decodeBitMask(_data, DEVICES_355);
        } else if (dp === 356) {
            return decodeBitMask(_data, DEVICES_356);
        }
        return _data;
    } else if (type === 'DPT_Date') {
        return dec.decodeDPT11(data);
    } else if (type === 'DPT_FlowRate_m3/h') {
        return Math.round((dec.decodeDPT13(data) / 10000) * 100) / 100;
    } else if (type === 'DPT_ActiveEnergy') {
        return dec.decodeDPT13(data);
    } else if (type === 'DPT_ActiveEnergy_kWh') {
        return dec.decodeDPT13(data);
    } else if (type === 'DPT_DHWMode') {
        _data = data.readUInt8(0);
        if (datapoints[dp].name === 'Programmwahl Warmwasser') {
            if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 2) {
                return 'Dauerbetrieb';
            } else if (_data === 4) {
                return 'Standby';
            }
        }
        adapter.log.debug(`Unknown DHWMode value ${_data} for DP ${dp}`);
        return String(_data);

    }
    else if (type === 'DPT_HVACMode') {
        _data = data.readUInt8(0);

        if (datapoints[dp].name === 'Programmwahl Heizkreis' || datapoints[dp].name === 'Programmwahl Mischer') {
            if (_data === 2) {
                return 'Standby';
            } else if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 1) {
                return 'Heizbetrieb';
            } else if (_data === 3) {
                return 'Sparbetrieb';
            } else if (_data === 4) {
                // Building Protection (ISM8i manual, 8.7.3)
                return 'Permanent Kühlen';
            } else {
                adapter.log.debug(`Unknown HVACMode value ${_data} for DP ${dp}`);
                return String(_data);
            }
        } else if (datapoints[dp].name === 'Programmwahl CWL') {
            if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 1) {
                return 'Nennlüftung';
            } else if (_data === 3) {
                return 'Reduzierte Lüftung';
            } else if (_data === 4) {
                return 'Feuchteschutz';
            } else {
                adapter.log.debug(`Unknown HVACMode value ${_data} for DP ${dp}`);
                return String(_data);
            }
        } else {
            return 'not defined';
        }
    } else if (type === 'DPT_HVACContrMode') {
        // Betriebsart (ISM8i manual, 8.7.1, 8.7.2)
        _data = data.readUInt8(0);
        if (_data === 7 && dp < 177) {
            // Test or GLT mode of gas and oil boilers
            return 'GLT / Test';
        }
        if (HVAC_CONTR_MODES[_data] !== undefined) {
            return HVAC_CONTR_MODES[_data];
        }
        adapter.log.debug(`Unknown HVACContrMode value ${_data} for DP ${dp}`);
        return String(_data);
    } else if (type === 'DPT_Unknown1') {
        return data.readUInt8(0).toString();
    } else if (type === 'DPT_Unknown2') {
        return data.readUInt16BE(0).toString();
    } else {
        throw new Error(`Unknown type ${type}`);
    }
}

/**
 * Converts a value to a number. Returns NaN for values that are not numbers or numeric strings.
 */
function toNumber(value) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        return Number(value);
    }
    return NaN;
}

/**
 * Limits a numeric value to min...max and rounds it to the step.
 */
function limit(data, min, max, step) {
    const value = toNumber(data);
    if (isNaN(value)) {
        throw new Error(`Invalid number "${data}"`);
    }
    return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/**
 * Parses a date. Accepted: "YYYY-MM-DD", "DD.MM.YYYY", everything that Date can parse and timestamps.
 */
function parseDate(data) {
    let date;
    const text = typeof data === 'string' ? data.trim() : '';
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
        date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    } else if ((m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
        date = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    } else {
        date = new Date(data);
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    // DPT 11.001 can store the years 2000...2089 (the decoder treats 90...99 as 1990...1999)
    if (isNaN(date.getTime()) || date.getFullYear() < 2000 || date.getFullYear() > 2089) {
        throw new Error(`Invalid date "${data}"`);
    }
    return date;
}

/**
 * Parses a time of day. Accepted: "HH:MM", "HH:MM:SS", everything that Date can parse and timestamps.
 */
function parseTime(data) {
    const text = typeof data === 'string' ? data.trim() : '';
    const m = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
        const hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        const seconds = parseInt(m[3] || '0', 10);
        if (hours > 23 || minutes > 59 || seconds > 59) {
            throw new Error(`Invalid time "${data}"`);
        }
        const time = new Date();
        time.setHours(hours, minutes, seconds, 0);
        return time;
    }
    const time = new Date(data);
    if (isNaN(time.getTime())) {
        throw new Error(`Invalid time "${data}"`);
    }
    return time;
}

/**
 * Finds the value of a program selection. A value can be given as number (Wolf numbering, as on the
 * control unit) or as text (as the adapter shows it).
 *
 * @param {any} data value written by the user
 * @param {{num: number, text: string, raw: number}[]} programs allowed programs
 * @returns {number} the value to send (KNX encoding)
 */
function findProgram(data, programs) {
    const num = toNumber(data);
    const program = programs.find(p => p.text === data || p.num === num);
    if (!program) {
        throw new Error(`Invalid value "${data}", allowed: ${programs.map(p => `${p.num} or "${p.text}"`).join(', ')}`);
    }
    return program.raw;
}

// Programmwahl Warmwasser: number as on the control unit (ISM8i manual, 8.7.4) -> DPT_DHWMode
const PROGRAMS_DHW = [
    { num: 0, text: 'Standby', raw: 4 },
    { num: 1, text: 'Automatikbetrieb', raw: 0 },
    { num: 2, text: 'Dauerbetrieb', raw: 2 },
];
// Programmwahl Heizkreis/Mischer: number as on the control unit (ISM8i manual, 8.7.3) -> DPT_HVACMode
const PROGRAMS_HEATING = [
    { num: 0, text: 'Standby', raw: 2 },
    { num: 1, text: 'Automatikbetrieb', raw: 0 },
    { num: 2, text: 'Heizbetrieb', raw: 1 },
    { num: 3, text: 'Sparbetrieb', raw: 3 },
];
// Programmwahl CWL: number as DPT_HVACMode value (ISM8i manual, 8.7.5)
const PROGRAMS_CWL = [
    { num: 0, text: 'Automatikbetrieb', raw: 0 },
    { num: 1, text: 'Nennlüftung', raw: 1 },
    { num: 3, text: 'Reduzierte Lüftung', raw: 3 },
    { num: 4, text: 'Feuchteschutz', raw: 4 },
];

/**
 * Encodes a value for the ISM8i.
 *
 * @returns {[Buffer, any]} the encoded value and the value for the state (limited and rounded)
 */
function encode(data, dp) {
    const type = datapoints[dp].type;
    const name = datapoints[dp].name;
    let buffer;
    // Value for the state. For DPT 9 the limited value is used, because DPT 9 cannot store
    // every value exactly (e.g. 85 is sent as 85.04). Other values are decoded from the buffer.
    let value;

    if (type === 'DPT_Switch') {
        buffer = Buffer.from(['On', 'on', 'Enable', '1', 'true', 1, true].includes(data) ? [1] : [0]);
    } else if (type === 'DPT_Scaling') {
        // DPT 5.001: 0...255 = 0...100 % (ISM8i manual, 8.6.2)
        const percent = limit(data, datapoints[dp].min || 0, datapoints[dp].max === undefined ? 100 : datapoints[dp].max, 1);
        buffer = enc.encodeDPT5(Math.round(percent * 255 / 100));
    } else if (type === 'DPT_Value_1_Ucount') {
        buffer = enc.encodeDPT5(limit(data, 0, 255, 1));
    } else if (type === 'DPT_Value_2_Ucount') {
        buffer = enc.encodeDPT7(limit(data, 0, 65535, 1));
    } else if (type === 'DPT_Tempd' && name === 'Sollwertkorrektur') {
        value = limit(data, -4, 4, 0.5);
        buffer = enc.encodeDPT9(value);
    } else if (type === 'DPT_Tempd' && name === 'Sparfaktor') {
        value = limit(data, 0, 10, 0.5);
        buffer = enc.encodeDPT9(value);
    } else if (name === 'Programmwahl Warmwasser') {
        buffer = Buffer.from([findProgram(data, PROGRAMS_DHW)]);
    } else if (name === 'Programmwahl Mischer' || name === 'Programmwahl Heizkreis') {
        buffer = Buffer.from([findProgram(data, PROGRAMS_HEATING)]);
    } else if (type === 'DPT_HVACMode' && name === 'Programmwahl CWL') {
        buffer = Buffer.from([findProgram(data, PROGRAMS_CWL)]);
    } else if (type === 'DPT_Date') {
        buffer = enc.encodeDPT11(parseDate(data));
    } else if (type === 'DPT_TimeOfDay') {
        // The weekday is not used by the ISM8i
        buffer = enc.encodeDPT10(parseTime(data));
    } else if (type === 'DPT_Value_Temp' && (name === 'Warmwassersolltemperatur' || name === 'Kesselsolltemperaturvorgabe' || name === 'Sammlersolltemperaturvorgabe')) {
        // the limits are in datapoints.json (ISM8i manual, 8.8)
        value = limit(data, datapoints[dp].min, datapoints[dp].max, 1);
        buffer = enc.encodeDPT9(value);
    } else {
        throw new Error('Encoding not supported');
    }

    return [buffer, value === undefined ? decode(type, buffer, dp) : value];
}

/**
 * Creates a DatapointValue.Ind telegram to write one datapoint (ISM8i manual, chapter 8.2)
 */
function createWriteTelegram(dp, value) {
    const telegram = Buffer.alloc(20 + value.length);
    splitter.copy(telegram, 0); // 06 20 F0 80
    telegram.writeUInt16BE(telegram.length, 4); // frame size
    Buffer.from('04000000F0C1', 'hex').copy(telegram, 6); // connection header, ObjectServer, DatapointValue.Ind
    telegram.writeUInt16BE(dp, 12); // start datapoint
    telegram.writeUInt16BE(1, 14); // number of datapoints
    telegram.writeUInt16BE(dp, 16); // datapoint ID
    telegram[18] = 0; // state, always 0
    telegram[19] = value.length;
    value.copy(telegram, 20);
    return telegram;
}

function addGroup(dev) {
    const nameKey = dev.replace('_t', '_n');
    let groupName = adapter.config.names[nameKey];
    if (!groupName) {
        if (dev.match(/^hg/)) {
            groupName = `Heizgerät ${dev.slice(-3, -2)}`;
        } else if (dev.match(/^bm/)) {
            groupName = `Bediengerät ${dev.slice(-3, -2)}`;
        } else if (dev.match(/^mm/)) {
            groupName = `Mischermodul ${dev.slice(-3, -2)}`;
        } else if (dev.match(/^km/)) {
            groupName = 'Kaskadenmodul';
        } else if (dev.match(/^sm/)) {
            groupName = 'Solarmodul';
        } else if (dev.match(/^cwl/)) {
            groupName = 'Comfort-Wohnungs-Lüftung';
        } else {
            groupName = 'Unbekannte Datenpunkte';
        }
    }
    adapter.log.debug(`Add Channel ${dev} : ${groupName}`);
    adapter.extendObject(dev, {
        type: 'channel',
        common: {
            name: groupName
        },
        native: {}
    });
}

async function addDevice(dp) {
    const dev = getDevice(dp);
    if (dev) {
        //ack_data.new_devices.push(dev);
        const ranges = getDeviceRages(dev);

        addGroup(dev);

        for (const range of ranges) {

            for (let idx = range.lsb; idx <= range.msb; idx++) {

                if (!ack_data[idx]) {
                    adapter.log.debug(`Add objects for ${dev}.${idx}`);
                    const data = datapoints[idx];
                    if (!data) {
                        adapter.log.warn(`No data for ${dev}.${idx}`);
                        continue;
                    }
                    if (adapter.config.bool_bar && data.einheit === 'Pa') {
                        data.einheit = 'bar';
                    }
                    const commonType = getCommonType(idx);
                    ack_data[idx] = { id: `${adapter.namespace}.${dev}.${idx}` };
                    //console.log('add:' + dev + '.' + idx  );
                    // min/max only for writable states, the values sent by the device are not limited
                    if (commonType === 'number' && data.rw.includes('w')) {
                        await adapter.extendObject(`${dev}.${idx}`, {
                            type: 'state',
                            common: {
                                name:    data.name,
                                role:    data.type.replace('DPT_', '').toLowerCase(),
                                type:    commonType,
                                read:    data.read,
                                write:   data.write,
                                unit:    data.einheit,
                                min:     data.min,
                                max:     data.max
                            },
                            native: {
                                rw: data.rw
                            }
                        });
                    } else {
                        await adapter.extendObject(`${dev}.${idx}`, {
                            type: 'state',
                            common: {
                                name:    data.name,
                                role:    data.type.replace('DPT_', '').toLowerCase(),
                                type:    commonType,
                                read:    data.read,
                                write:   data.write,
                                unit:    data.einheit
                            },
                            native: {
                                rw: data.rw
                            }
                        });
                    }
                }
            }
        }

        return true;
    }
    return false;
}

function main() {
    // Fix wrong config from before 12.12.2022
    if (adapter.config.devices.mm11_t) {
        adapter.config.devices.mm1_t = adapter.config.devices.mm11_t;
        delete adapter.config.devices.mm11_t;
    }
    if (adapter.config.names.mm11_n) {
        adapter.config.names.mm1_n = adapter.config.names.mm11_n;
        delete adapter.config.names.mm11_n;
    }
    if (adapter.config.devices.mm12_t) {
        adapter.config.devices.mm2_t = adapter.config.devices.mm12_t;
        delete adapter.config.devices.mm12_t;
    }
    if (adapter.config.names.mm12_n) {
        adapter.config.names.mm2_n = adapter.config.names.mm12_n;
        delete adapter.config.names.mm12_n;
    }
    if (adapter.config.devices.mm13_t) {
        adapter.config.devices.mm3_t = adapter.config.devices.mm13_t;
        delete adapter.config.devices.mm13_t;
    }
    if (adapter.config.names.mm13_n) {
        adapter.config.names.mm3_n = adapter.config.names.mm13_n;
        delete adapter.config.names.mm13_n;
    }

    adapter.config.polling_interval = parseInt(adapter.config.polling_interval, 10);
    if (isNaN(adapter.config.polling_interval) || adapter.config.polling_interval < 0 || adapter.config.polling_interval > 2147482) {
        adapter.log.info('Invalid polling interval. Disable polling.');
        adapter.config.polling_interval = 0;
    }
    adapter.config.bool_bar = adapter.config.bool_bar === true || adapter.config.bool_bar === 'true';
    adapter.getForeignObjects(`${adapter.namespace}.*`, (err, list) => {
        for (const idd in list) {
            if (list.hasOwnProperty(idd)) {
                ack_data.old_devices[idd.split('.')[2]] = idd.split('.')[2];

                const obj = list[idd];
                const dp = idd.split('.').pop();
                const data = datapoints[dp];
                if (!data || !obj || obj.type !== 'state') {
                    continue;
                }

                // Only an object at the expected path counts as existing. Older versions created some
                // datapoints in other channels. Such an object must not block creating the object at the
                // expected path, otherwise values are written to a state without object (#96).
                const expectedId = `${adapter.namespace}.${getDevice(dp)}.${dp}`;
                if (idd !== expectedId) {
                    adapter.log.info(`Object ${idd} is obsolete and not updated any more, the value of datapoint ${dp} is now in ${expectedId}. You can delete ${idd}.`);
                    continue;
                }
                ack_data[dp] = {id: idd};

                // Fix existing objects created by older versions or with other settings
                if (obj.common) {
                    let changed = false;

                    // Fix type if "status as boolean" was changed
                    if (BOOLEAN_TYPES.includes(data.type)) {
                        const commonType = getCommonType(dp);
                        if (obj.common.type !== commonType) {
                            adapter.log.debug(`Update type of ${idd} from ${obj.common.type} to ${commonType}`);
                            obj.common.type = commonType;
                            changed = true;
                        }
                    }

                    if (!data.rw.includes('w')) {
                        // Remove min/max from read-only states
                        if (obj.common.min !== undefined || obj.common.max !== undefined) {
                            delete obj.common.min;
                            delete obj.common.max;
                            changed = true;
                        }
                    } else if (getCommonType(dp) === 'number' && (obj.common.min !== data.min || obj.common.max !== data.max)) {
                        // Update min/max of writable states to the current limits
                        adapter.log.debug(`Update min/max of ${idd} to ${data.min}..${data.max}`);
                        obj.common.min = data.min;
                        obj.common.max = data.max;
                        changed = true;
                    }

                    changed && adapter.setForeignObject(idd, obj);
                }
            }
        }

        // Remap devices from earlier names (without _t/_n postfix)
        for (const devName of Object.keys(adapter.config.devices)) {
            if (!devName.endsWith('_t') && adapter.config.devices[devName + '_t'] === undefined) {
                adapter.config.devices[devName + '_t'] = adapter.config.devices[devName];
                delete adapter.config.devices[devName];
            }
        }
        for (const devName of Object.keys(adapter.config.names)) {
            if (!devName.endsWith('_n') && adapter.config.names[devName + '_n'] === undefined) {
                adapter.config.names[devName + '_n'] = adapter.config.names[devName];
                delete adapter.config.names[devName];
            }
        }

        // Fixup config
        if (adapter.config.devices.bm1_t === 'Auto' || adapter.config.devices.bm2_t === 'Auto' || adapter.config.devices.bm3_t === 'Auto' || adapter.config.devices.bm4_t === 'Auto') {
            adapter.config.devices['bm0_t'] = 'Auto';
        } else {
            adapter.config.devices['bm0_t'] = 'off';
        }

        const devices = adapter.config.devices;
        for (const dev in devices) {
            if (devices.hasOwnProperty(dev) && ack_data.old_devices[dev]) {
                if (devices[dev] === 'off') {
                    adapter.deleteChannel(dev);
                } else {
                    addGroup(dev);
                }
            }
        }

        updateConnectionState();
        createServer(adapter);

        adapter.subscribeStates('*');
    });
}

function setState(adapter, dp, value, device, telegram) {
    let val;
    try {
        val = decode(datapoints[dp].type, value, dp);
    } catch (err) {
        adapter.log.error(`Can't parse DP : ${dp}, type ${datapoints[dp].type} - data: ${telegram.toString('hex')} - length: ${telegram.length}`);
        adapter.log.debug(`Incoming Device: ${device}, Datapoint: ${dp}, Datapoint_name: ${datapoints[dp].name}, Datapoint_type: ${datapoints[dp].type}, Data: ${telegram.toString('hex')}, Length: ${telegram.length}`);
        return;
    }
    adapter.log.debug(`Set Value for ${device}.${dp}.${datapoints[dp].name}: ${val}`);
    adapter.setState(`${device}.${dp}`, val, true)
        .catch(e => adapter.log.error(`Cannot set state ${device}.${dp}: ${e.message}`));
    ack_data[dp]['value'] = val;
}

/**
 * Splits received data into complete telegrams (ISM8i manual, chapter 8.2).
 * The frame size (bytes 4-5) tells how long a telegram is. An incomplete telegram at the end
 * stays in the buffer until the rest arrives with the next chunk.
 *
 * @returns {{telegrams: Buffer[], rest: Buffer}}
 */
function splitTelegrams(buffer) {
    const telegrams = [];
    while (buffer.length) {
        const start = buffer.indexOf(splitter);
        if (start === -1) {
            // keep the last bytes, they could be the beginning of the next header
            const keep = Math.min(buffer.length, splitter.length - 1);
            if (buffer.length > keep) {
                adapter.log.debug(`Ignore data without header: ${buffer.subarray(0, buffer.length - keep).toString('hex')}`);
            }
            buffer = buffer.subarray(buffer.length - keep);
            break;
        }
        if (start > 0) {
            adapter.log.debug(`Ignore data before header: ${buffer.subarray(0, start).toString('hex')}`);
            buffer = buffer.subarray(start);
        }
        if (buffer.length < 6) {
            // frame size not received yet
            break;
        }
        const frameSize = buffer.readUInt16BE(4);
        if (frameSize < 12) {
            adapter.log.debug(`Ignore telegram with invalid frame size ${frameSize}: ${buffer.toString('hex')}`);
            buffer = buffer.subarray(splitter.length);
            continue;
        }
        if (buffer.length < frameSize) {
            // wait for the rest of the telegram
            break;
        }
        telegrams.push(buffer.subarray(0, frameSize));
        buffer = buffer.subarray(frameSize);
    }
    return { telegrams, rest: buffer };
}

/**
 * Parses a SetDatapointValue.Req telegram (MainService 0xF0, SubService 0x06, ISM8i manual chapter 8.2).
 * One telegram can contain several datapoints.
 *
 * @returns {{startDp: number, datapoints: {dp: number, value: Buffer}[]} | null} null if the telegram is not a SetDatapointValue.Req
 */
function parseTelegram(telegram) {
    if (telegram.length < 16 || telegram[10] !== 0xF0 || telegram[11] !== 0x06) {
        return null;
    }
    const startDp = telegram.readUInt16BE(12);
    const count = telegram.readUInt16BE(14);
    const result = [];
    let offset = 16;
    for (let i = 0; i < count; i++) {
        if (offset + 4 > telegram.length) {
            adapter.log.debug(`Telegram contains less datapoints than announced (${i} of ${count}): ${telegram.toString('hex')}`);
            break;
        }
        const dp = telegram.readUInt16BE(offset);
        const length = telegram[offset + 3];
        const value = telegram.subarray(offset + 4, offset + 4 + length);
        if (value.length < length) {
            adapter.log.debug(`Value of DP ${dp} is incomplete: ${telegram.toString('hex')}`);
            break;
        }
        result.push({ dp, value });
        offset += 4 + length;
    }
    return { startDp, datapoints: result };
}

async function processDatapoint(dp, value, telegram) {
    const datapoint = datapoints[dp];
    if (!datapoint) {
        adapter.log.debug(`Unknown datapoint ${dp} - data: ${telegram.toString('hex')}`);
        return;
    }
    if (!value.length) {
        adapter.log.debug(`Skip DP ${dp} without value - data: ${telegram.toString('hex')} - length: ${telegram.length}`);
        return;
    }

    const device = getDevice(dp);
    adapter.log.debug(`Data for ${device} : ${dp}`);
    if (adapter.config.devices[device] === 'Auto' || (dp >= 212 && dp <= 250) || (dp >= 252 && dp <= 354)) {
        if (ack_data[dp]) {
            setState(adapter, dp, value, device, telegram);
        } else {
            if (datapoint.name === 'Störung') {
                if (value.readInt8(0) === 1) {
                    ignore[device] = true;
                    adapter.log.info(`heating ${device} do not exist`);
                } else {
                    ignore[device] = undefined;
                }
            }

            if (!ignore[device]) {
                if (await addDevice(dp)) {
                    adapter.log.debug(`create objects: ${dp}`);
                    setState(adapter, dp, value, device, telegram);
                }
            }
        }
    } else if (device) {
        adapter.log.debug(`Device ${device} is disabled, datapoint ${dp} ignored`);
    } else {
        adapter.log.debug(`For datapoint ${dp} no device defined.`);
    }
}

async function processTelegram(sock, telegram) {
    adapter.log.debug(`Received telegram from ${sock.remoteAddress}:${sock.remotePort}: ${telegram.toString('hex')}`);
    const parsed = parseTelegram(telegram);
    if (!parsed) {
        adapter.log.debug(`Ignore telegram with service ${telegram.subarray(10, 12).toString('hex')}`);
        return;
    }

    // Every SetDatapointValue.Req must be acknowledged, otherwise the ISM8i repeats it 5 times.
    // A new buffer is used for every acknowledgement, because socket.write() may still hold the previous one.
    const ack = Buffer.from(buffReq);
    ack.writeUInt16BE(parsed.startDp, 12);
    adapter.log.debug(`Acknowledge ${ack.toString('hex')}`);
    sock.write(ack);

    for (const { dp, value } of parsed.datapoints) {
        await processDatapoint(dp, value, telegram);
    }
}

// Telegrams are processed one after another, so that objects are completely created before the next value arrives
let processing = Promise.resolve();

function createServer(adapter) {
    adapter._server = net.createServer(sock => {
        const address = `${sock.remoteAddress}:${sock.remotePort}`;

        // The ISM8i opens a new connection if the old one is broken. The old connection is often
        // not closed properly (half-open), so it is closed here. Otherwise, writes go to a dead connection.
        for (const old of adapter._connections.filter(s => s.remoteAddress === sock.remoteAddress)) {
            adapter.log.info(`New connection from ${address}, close old connection from ${old.remoteAddress}:${old.remotePort}`);
            adapter._connections.splice(adapter._connections.indexOf(old), 1);
            old.destroy();
        }
        adapter._connections.push(sock);
        adapter.log.info(`ISM8i connected from ${address}`);
        updateConnectionState();

        // detect dead connections, e.g. if the ISM8i lost power or the network was interrupted
        sock.setKeepAlive(true, 60000);

        let received = Buffer.alloc(0);

        sock.on('error', err => {
            if (['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(err.code)) {
                adapter.log.info(`Connection from ${address} lost: ${err.code}`);
            } else {
                adapter.log.warn(`Socket error from ${address}: ${err.message}`);
            }
        });

        sock.on('data', chunk => {
            adapter.log.debug(`Received Data from ${sock.remoteAddress}:${sock.remotePort}: ${chunk.toString('hex')}`);
            const { telegrams, rest } = splitTelegrams(Buffer.concat([received, chunk]));
            received = rest;
            for (const telegram of telegrams) {
                processing = processing
                    .then(() => processTelegram(sock, telegram))
                    .catch(e => adapter.log.error(`Cannot process telegram ${telegram.toString('hex')}: ${e.message}`));
            }
        });

        // 'close' is emitted after 'end' and after 'error', so every closed connection is removed
        sock.on('close', () => {
            const pos = adapter._connections.indexOf(sock);
            pos !== -1 && adapter._connections.splice(pos, 1);
            adapter.log.info(`Connection from ${address} closed`);
            updateConnectionState();
        });

        adapter.log.debug(`Requesting all values from ${address} (GetAll)`);
        sock.write(buffGetAll);

        initPolling();
    });

    adapter._server.on('error', err => adapter.log.error(`Cannot start server: ${err.toString()}`));

    adapter._server.listen(adapter.config.port, adapter.config.bind);

    adapter.log.debug(`Server listening on ${adapter.config.bind}:${adapter.config.port}`);
}


//function test(_data) {
//    const _data = Buffer.from('0620f080001504000000f00600020001000203010b', 'hex');
//    const val;
//    const dp = _data.readUInt16BE(12);
//    const device = getDevice(dp);
//
//
//    try {
//        val = decode(datapoints[dp].type, _data.slice(20), dp);
//    }
//    catch (err) {
//        val = '';
//        console.log('Can\'t parse DP : ' + dp + ' - data: ' + _data.toString('hex') + ' - length: ' + _data.length)
//        console.log(err)
//    }
//
//    console.log('-----------------------------------------');
//    console.log('Device: ' + device);
//    console.log('Datapoint: ' + dp);
//    console.log('Datapoint_name: ' + datapoints[dp].name);
//    console.log('Datapoint_type: ' + datapoints[dp].type);
//    console.log('value: ' + val);
//    console.log('oid: ' + device + '.' + dp);
//}
//test()

// todo DPT_HVACContrMode 0620f080001504000000f00600020001000203010b
// todo DPT_HVACContrMode 0620f080001504000000f006000200010002030101

// If started as allInOne mode => return function to create instance
if (module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
