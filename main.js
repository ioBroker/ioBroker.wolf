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

function toHex(num) {
    let val = num.toString(16);
    if (val.length < 2) val = `0${val}`;
    return val;
}

function initPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (adapter.config.polling_interval === 0) return;

    pollingInterval = setInterval(() => {
        const sock = adapter._connections[adapter._connections.length - 1];
        sock.write(buffGetAll);
    }, adapter.config.polling_interval * 1000);
}

function startAdapter(options) {
    options = options || {};
    options.name = adapterName;

    adapter = new utils.Adapter(options);

    adapter._connections = [];

    adapter.on('ready', () => main());
    adapter.on('unload', cb => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
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
                adapter.setState(id, ack_data[dp].value, true);
                adapter.log.error(`${id} is only readable`);
            } else {
                try {
                    const enc = encode(state.val, dp);
                    const bufVal = enc[0];
                    const _buff_set = Buffer.concat([Buffer.from(`0620F08000${toHex(20 + bufVal.length)}04000000F0C100${toHex(dp)}000100${toHex(dp)}00${toHex(bufVal)}`, 'hex'), bufVal], bufVal.length + 20);

                    adapter._connections.forEach(sock => sock.write(_buff_set));
                    adapter.log.debug(`send ${_buff_set.toString('hex')}`);
                    adapter.setState(id, enc[1], true);
                } catch (e) {
                    adapter.log.error(`Can't encode DP (${e.message}) : ${dp} - data: ${state.val} - type: ${datapoints[dp].type}`);
                }
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
    } else if ((dp >= 53 && dp <= 66) || (dp === 194) || (dp === 368) || (dp >= 355 && dp <= 361) || (dp === 251)) {
        return 'bm1_t';
    } else if ((dp >= 67 && dp <= 79) || (dp === 369)) {
        return 'bm2_t';
    } else if ((dp >= 80 && dp <= 92) || (dp === 370)) {
        return 'bm3_t';
    } else if ((dp >= 93 && dp <= 105)|| (dp === 371)) {
        return 'bm4_t';
    } else if ((dp >= 106 && dp <= 113) || (dp >= 209 && dp <= 210)) {
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
        return [{ 'lsb': 14, 'msb': 26 }, { 'lsb': 200, 'msb': 202 }, { 'lsb3': 365, 'msb3': 365 }];
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
        return [{ 'lsb': 106, 'msb': 113 }, { 'lsb': 209, 'msb': 210 }];
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
            return 'false';
        } else {
            return 'true';
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
        return Math.round(parseInt(dec.decodeDPT5(data)) * 0.4);
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
        if (dp === 357 || dp === 359 || dp === 360 || dp === 361){
            _data = dec.decodeDPT5(data);
            switch (_data){
                case 0:
                    return 'kein Heizgerät';
                case 1:
                    return 'CGB-2';
                case 2:
                    return 'MGK-2';
                case 3:
                    return 'TOB';
                case 4:
                    return 'BWL-1S';
                case 5:
                    return 'FGB';
                case 6:
                    return 'CHA';
                case 7:
                    return 'COB-2';
                case 8:
                    return 'CGB-2 38/55';
                case 9:
                    return 'CGB-2 38/55';
                case 10:
                    return 'TGB-2';
                case 11:
                    return 'TGB-2';
                case 12:
                    return 'CGB-2 75/100';
                case 13:
                    return 'CGB-2 75/100';
                case 14:
                    return 'FHA';
                default:
                    return '';
            }
        } else if (dp === 358){
            _data = dec.decodeDPT5(data);
            switch (_data){
                case 1:
                    return 'Dir. Warmwasser';
                case 2:
                    return 'Warmwasser 1';
                case 4:
                    return 'Warmwasser 2';
                case 8:
                    return 'Warmwasser 3';
                case 16:
                    return 'Warmwasser 4';
                case 32:
                    return 'Warmwasser 5';
                case 64:
                    return 'Warmwasser 6';
                case 128:
                    return 'Warmwasser 7';
                default:
                    return '';
            }
        } else if (dp === 251){
            _data = dec.decodeDPT5(data);
            switch (_data){
                case 1:
                    return 'Dir. Heizkreis';
                case 2:
                    return 'Mischerkreis 1';
                case 4:
                    return 'Mischerkreis 2';
                case 8:
                    return 'Mischerkreis 3';
                case 16:
                    return 'Mischerkreis 4';
                case 32:
                    return 'Mischerkreis 5';
                case 64:
                    return 'Mischerkreis 6';
                case 128:
                    return 'Mischerkreis 7';
                default:
                    return '';
            }
        }
    } else if (type === 'DPT_Value_2_Ucount') {
        _data = dec.decodeDPT7(data);
        let wert = "";
        if (dp === 355){
            // 16 max length in bit - only 14 are currentyl needed
            let y = 16 -_data.length;
            for (let i = 0; i < 14; i++){
                if (_data.slice(i, i + 1) == 1) {
                    switch (i+y){
                        case 2:
                            wert += ' Solarmodul, ';
                            break;
                        case 3:
                            wert += ' Heizgerät 4, ';
                            break;
                        case 4:
                            wert += ' Heizgerät 4, ';
                            break;
                        case 5:
                            wert += ' Heizgerät 3, ';
                            break;
                        case 6:
                            wert += ' Heizgerät 2, ';
                            break;
                        case 7:
                            wert += ' Heizgerät 1, ';
                            break;
                        case 8:
                            wert += ' Mischermodul, ';
                            break;
                        case 9:
                            wert += ' Mischermodul, ';
                            break;
                        case 10:
                            wert += ' Mischermodul, ';
                            break;
                        case 11:
                            wert += ' Mischermodul, ';
                            break;
                        case 12:
                            wert += ' Mischermodul 3, ';
                            break;
                        case 13:
                            wert += ' Mischermodul 2, ';
                            break;
                        case 14:
                            wert += ' Mischermodul 1, ';
                            break;
                    }
                }
            }
        }
        if (dp === 356){
            _data = dec.decodeDPT7(data);
            let wert = "";
            // 16 max length in bit - only 11 are currently needed
            let y = 16 -_data.length;
            for (let i = 0; i < 12; i++){
                if (_data.slice(i, i + 1) == 1) {
                    switch (i+y){
                        case 9:
                            wert += ' CWL Excellent, ';
                            break;
                        case 8:
                            wert += '';
                            break;
                        case 7:
                            wert += '' ;
                            break;
                        case 6:
                            wert += ' Solarmodul 1, ';
                            break;
                        case 5:
                            wert += ' Solarmodul 2, ';
                            break;
                        case 4:
                            wert += ' BM-2(0)/System, ';
                            break;
                    }
                }
            }
        }
        return wert;
    } else if (type === 'DPT_Date') {
        return dec.decodeDPT11(data);
    } else if (type === 'DPT_FlowRate_m3/h') {
        return Math.round((dec.decodeDPT13(data) / 10000) * 100) / 100;
    } else if (type === 'DPT_ActiveEnergy') {
        return dec.decodeDPT13(data);
    } else if (type === 'DPT_ActiveEnergy_kWh') {
        return dec.decodeDPT13(data);
    } else if (type === 'DPT_DHWMode') {
        _data = data.readInt8(0);
        if (datapoints[dp].name === 'Programmwahl Warmwasser') {
            if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 2) {
                return 'Dauerbetrieb';
            } else if (_data === 4) {
                return 'Standby';
            } else {
                throw '';
            }
        } else {
            throw '';
        }

    }
    else if (type === 'DPT_HVACMode') {
        _data = data.readInt8(0);

        if (datapoints[dp].name === 'Programmwahl Heizkreis' || datapoints[dp].name === 'Programmwahl Mischer') {
            if (_data === 2) {
                return 'Standby';
            } else if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 1) {
                return 'Heizbetrieb';
            } else if (_data === 3) {
                return 'Sparbetrieb';
            } else {
                return _data;
            }
        } else if (datapoints[dp].name === 'Programmwahl CWL') {
            if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 1) {
                return 'Nennlüftung';
            } else if (_data === 3) {
                return 'Reduzierte Lüftung';
            } else {
                return _data;
            }
        } else {
            return 'not defined';
        }
    } else if (type === 'DPT_HVACContrMode') {
        _data = data.readInt8(0);
        if (dp < 177) {
            if (_data === 0) {
                return 'Auto';
            } else if (_data === 1) {
                return 'Heat';
            } else if (_data === 6) {
                return 'Off';
            } else if (_data === 7) {
                return 'GLT / Test';
            } else if (_data === 11) {
                return 'Ice';
            } else if (_data === 15) {
                return 'Calibration Mode';
            } else {
                throw '';
            }
        } else {
            if (_data === 0) {
                return 'Auto';
            } else if (_data === 1) {
                return 'Heat';
            } else if (_data === 3) {
                return 'Cool';
            } else if (_data === 6) {
                return 'Off';
            } else if (_data === 7) {
                return 'Test';
            } else if (_data === 11) {
                return 'Ice';
            } else {
                throw '';
            }
        }
    } else if (type === 'DPT_Unknown1') {
        return data.readUInt8(0).toString();
    } else if (type === 'DPT_Unknown2') {
        return data.readUInt16BE(0).toString();
    } else {
        throw '';
    }
}

function encode(data, dp) {
    let val;
    // const _data;
    const type = datapoints[dp].type;
    const name = datapoints[dp].name;
    //"DPT_Value_Temp",
    //"DPT_HVACMode",
    //"DPT_DHWMode",
    //"DPT_Switch",
    //"DPT_Tempd",
    //"DPT_TimeOfDay"
    //"DPT_Scaling"
    //"DPT_Value_1_Ucount"
    //"DPT_Value_2_Ucount"

    if (type === 'DPT_Switch') {
        if (['On', 'on', 'Enable', '1', 'true', 1, true].indexOf(data) > -1) {
            if (adapter.config.bool_status) {
                return [Buffer.from('01', 'hex'), 'true'];
            } else {
                return [Buffer.from('01', 'hex'), 'On'];
            }
        } else {
            if (adapter.config.bool_status) {
                return [Buffer.from('00', 'hex'), 'false'];
            } else {
                return [Buffer.from('00', 'hex'), 'Off'];
            }
        }
    } else if (type === 'DPT_Scaling') {
        val = Math.round(data * 2) / 2;
        if (val > 100) {
            val = 100
        }
        if (val < 0) {
            val = 0
        }
        return [enc.encodeDPT5(data), val];
    } else if (type === 'DPT_Value_1_Ucount') {
        return [enc.encodeDPT5(data), val];
    } else if (type === 'DPT_Value_2_Ucount') {
        return [enc.encodeDPT7(data), val];
    } else if (type === 'DPT_Tempd' && name === 'Sollwertkorrektur') {
        val = Math.round(data * 2) / 2;
        if (val > 4) {
            val = 4
        }
        if (val < -4) {
            val = 4
        }
        return [enc.encodeDPT9(data), val];
    } else if (type === 'DPT_Tempd' && name === 'Sparfaktor') {
        val = Math.round(data * 2) / 2;
        if (val > 10) {
            val = 10
        }
        if (val < 0) {
            val = 0
        }
        return [enc.encodeDPT9(data), val];
    } else if (name === 'Programmwahl Warmwasser') {
        if (data == 0 || data === 'Standby') {
            return [Buffer.from('04', 'hex'), 'Standby'];
        }
        else if (data == 2 || data === 'Dauerbetrieb') {
            return [Buffer.from('02', 'hex'), 'Dauerbetrieb'];
        } else {
            return [Buffer.from('00', 'hex'), 'Automatikbetrieb'];
        }
    } else if (name === 'Programmwahl Mischer' || name === 'Programmwahl Heizkreis') {
        if (data == 0 || data === 'Standby') {
            return [Buffer.from('02', 'hex'), 'Standby'];
        }
        else if (data == 1 || data === 'Automatikbetrieb') {
            return [Buffer.from('00', 'hex'), 'Automatikbetrieb'];
        } else if (data == 2 || data === 'Heizbetrieb') {
            return [Buffer.from('01', 'hex'), 'Heizbetrieb'];
        } else {
            return [Buffer.from('03', 'hex'), 'Sparbetrieb'];
        }
    } else if (type === 'DPT_HVACMode' && name === 'Programmwahl CWL') {
        if (data == 0 || data === 'Automatikbetrieb') {
            return [Buffer.from('00', 'hex'), 'Automatikbetrieb'];
        } else if (data == 1 || data === 'Nennlüftung') {
            return [Buffer.from('01', 'hex'), 'Nennlüftung'];
        } else if(data == 3 || data === 'Reduzierte Lüftung') {
            return [Buffer.from('03', 'hex'), 'Reduzierte Lüftung'];
        } else if(data == 4 || data === 'Feuchteschutz') {
            return [Buffer.from('04', 'hex'), 'Feuchteschutz'];
        }
    } else if (type === 'DPT_Date') {
        const dataDate = new Date(data);
        if (!isNaN(dataDate.getFullYear())) {
            const onlyDate = new Date(dataDate.getFullYear(), dataDate.getMonth(), dataDate.getDate());

            return [enc.encodeDPT11(onlyDate), onlyDate];
        }
        throw new Error('Invalid date');
    } else if (type === 'DPT_TimeOfDay') {
        const dataDate = new Date(data);
        // We ignore the weekday for now!
        return [enc.encodeDPT10(dataDate), dataDate];
    }
    if (name === 'Warmwassersolltemperatur') {
        val = parseInt(data);
        if (val > 65) {
            val = 65;
        }
        if (val < 0) {
            val = 0;
        }
        return [enc.encodeDPT9(data), val];
    } else if (name === 'Kesselsolltemperaturvorgabe') {
        val = parseInt(data);
        if (val > 90) {
            val = 90;
        }
        if (val < 0) {
            val = 0;
        }
        return [enc.encodeDPT9(data), val];
    } else {
        throw new Error('Encoding not supported');
    }
}

function bufferIndexOf(buf, search, offset) {
    offset = offset || 0;

    let m = 0;
    let s = -1;
    for (let i = offset; i < buf.length; ++i) {

        if (buf[i] != search[m]) {
            s = -1;
            m = 0;
        }

        if (buf[i] == search[m]) {
            if (s === -1) {
                s = i;
            }
            ++m;
            if (m === search.length) {
                break;
            }
        }
    }

    if (s > -1 && buf.length - s < search.length) {
        return -1;
    }
    return s;
}

function addGroup(dev) {
    let groupName = '';
    dev = dev.replace('_t','_n');
    if (adapter.config.names[`${dev}`] === '') {
        if (dev.match(/^hg/)) {
            groupName = `Heizgerät ${dev.slice(-3,-2)}`;
        } else if (dev.match(/^bm/)) {
            groupName = `Bediengerät ${dev.slice(-3,-2)}`;
        } else if (dev.match(/^mm/)) {
            groupName = `Mischermodul ${dev.slice(-3,-2)}`;
        } else if (dev.match(/^km/)) {
            groupName = 'Kaskadenmodul';
        } else if (dev.match(/^sm/)) {
            groupName = 'Solarmodul';
        } else if (dev.match(/^cwl/)) {
            groupName = 'Comfort-Wohnungs-Lüftung';
        }
    } else {
        groupName = adapter.config.names[`${dev}`];
    }
    if (dev !== "unknown") dev = dev.replace('n','t');
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
                    if (adapter.config.bool_status && ['DPT_Switch', 'DPT_Enable', 'DPT_OpenClose'].includes(data.type)) {
                        data.commonType = 'boolean';
                    }
                    ack_data[idx] = { id: `${adapter.namespace}.${dev}.${idx}` };
                    //console.log('add:' + dev + '.' + idx  );
                    if (data.commonType === 'number') {
                        await adapter.extendObject(`${dev}.${idx}`, {
                            type: 'state',
                            common: {
                                name:    data.name,
                                role:    data.type.replace('DPT_', '').toLowerCase(),
                                type:    data.commonType,
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
                                type:    data.commonType,
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
                ack_data[idd.split('.').pop()] = {id: idd};
                ack_data.old_devices[idd.split('.')[2]] = idd.split('.')[2];
            }
        }

        // Remap devices from earlier names (without _t/_n postfix)
        for (const devName in Object.keys(adapter.config.devices)) {
            if (!devName.endsWith('_t') && adapter.config.devices[devName + '_t'] === undefined) {
                adapter.config.devices[devName + '_t'] = adapter.config.devices[devName];
                delete adapter.config.devices[devName];
            }
        }
        for (const devName in Object.keys(adapter.config.names)) {
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

        createServer(adapter);

        adapter.subscribeStates('*');
    });
}

function setState(adapter, dp, val, data, device) {
    try {
        val = decode(datapoints[dp].type, data.slice(20), dp);
        adapter.log.debug(`Set Value for ${device}.${dp}.${datapoints[dp].name}: ${val}`);
        adapter.setState(`${device}.${dp}`, val, true);
        ack_data[dp]['value'] = val;
    } catch (err) {
        val = '';
        adapter.log.error(`Can't parse DP : ${dp}, type ${datapoints[dp].type} - data: ${data.toString('hex')} - length: ${data.length}`);
        datapoints[dp] && adapter.log.debug(`Incoming Device: ${device}, Datapoint: ${dp}, Datapoint_name: ${datapoints[dp].name}, Datapoint_type: ${datapoints[dp].type}, Data: ${data.toString('hex')}, Length: ${data.length}, Value: ${val}`
        );
    }
}

function createServer(adapter) {
    adapter._server = net.createServer(sock => {
        !adapter._connections.includes(sock) && adapter._connections.push(sock);

        //const buff_set = Buffer.from('0620F080001404000000F0C10039000100390001', 'hex');
        //0620F080001504000000F006006E0001006E030101
        let val;
        let dp;
        let device;
        let search;
        let lines;
        let data;

        sock.on('error', err => adapter.log.error(`Socket error: ${err.toString()}`));

        sock.on('data', async _data => {
            adapter.log.debug(`Received Data from ${sock.remoteAddress}:${sock.remotePort}: ${_data.toString('hex')}`);
            //console.log(_data)
            search = -1;
            lines = [];

            while ((search = bufferIndexOf(_data, splitter)) > -1) {
                lines.push(_data.slice(0, search + splitter.length));
                _data = _data.slice(search + splitter.length, _data.length);
            }

            _data.length && lines.push(_data);

            for (let i = 1; i < lines.length; i++) {
                data = Buffer.concat([splitter, lines[i]]);

                buffReq[12] = data[12];
                buffReq[13] = data[13];
                adapter.log.debug(`Acknowledge ${buffReq.toString('hex')}`);
                sock.write(buffReq);

                dp = data.readUInt16BE(12);
                device = getDevice(dp);
                adapter.log.debug(`Data for ${device} : ${dp}`);
                if (adapter.config.devices[device] === 'Auto') {
                    if (ack_data[dp]) {
                        setState(adapter, dp, val, data, device);
                    } else {
                        if (datapoints[dp].name === 'Störung') {
                            if (data.slice(20).readInt8(0) === 1) {
                                ignore[device] = true;
                                adapter.log.info(`heating ${device} do not exist`);
                            } else {
                                ignore[device] = undefined;
                            }
                        }

                        if (!ignore[device]) {
                            if (await addDevice(dp)) {
                                adapter.log.debug(`create object: ${dp}`);
                                setState(adapter, dp, val, data, device);
                            }
                        }
                    }
                } else {
                    if ((dp >= 212 && dp <= 250) || (dp >= 252 && dp <= 354)){
                        if (ack_data[dp]) {
                            setState(adapter, dp, val, data, device);
                        } else {
                            if (datapoints[dp].name === 'Störung') {
                                if (data.slice(20).readInt8(0) === 1) {
                                    ignore[device] = true;
                                    adapter.log.info(`heating ${device} do not exist`);
                                } else {
                                    ignore[device] = undefined;
                                }
                            }

                            if (!ignore[device]) {
                                if (await addDevice(dp)) {
                                    adapter.log.debug(`create objects: ${dp}`);
                                    setState(adapter, dp, val, data, device);
                                }
                            }
                        }
                    }else{
                        adapter.log.info(`For datapoint ${dp} no device defined.`);
                    }
                }
            }
        });

        sock.on('end', () => {
            const pos = adapter._connections.indexOf(sock);
            pos !== -1 && adapter._connections.splice(pos);
            adapter.log.debug(`Connection from ${sock.remoteAddress}:${sock.remotePort} closed`);
        });

        adapter.log.debug(`Receive new connection from ${sock.remoteAddress}:${sock.remotePort}, requesting GetAll`);
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
