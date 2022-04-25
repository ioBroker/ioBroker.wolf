'use strict';

const net         = require('net');
const utils       = require('@iobroker/adapter-core');
const adapterName = require('./package.json').name.split('.').pop();

const dec         = new (require('./js/decoder.js'))();
const enc         = new (require('./js/encoder.js'))();
const datapoints  = require('./js/datapoints.json');

let names      = '';
const ack_data = {
    old_devices: {},
    new_devices: []
};
const ignore   = {};
let adapter;

function startAdapter(options) {
    options = options || {};
    options.name = adapterName;

    adapter = new utils.Adapter(options);

    adapter._connections = [];

    adapter.on('ready', () => main());
    adapter.on('unload', cb => {
        if (adapter._server) {
            adapter._server.close(cb);
        } else {
            cb && cb();
        }
    });

    adapter.on('stateChange', (id, state) => {
        if (state && !state.ack && id) {
            const dp = parseInt(id.split('.').pop());
            if (datapoints[dp].rw === 'r') {
                adapter.setState(id, ack_data[dp].value, true);
                adapter.log.error('oid: ' + id + ' is only readable');
            } else {
                const enc = encode(state.val, dp);
                const bufVal = enc[0];
                if (bufVal !== 'error') {
                    const _buff_set = Buffer.concat([Buffer.from('0620F08000' + (20 + bufVal.length).toString(16) + '04000000F0C100' + dp.toString(16) + '000100' + dp.toString(16) + '000' + bufVal.length.toString(16) + '', 'hex'), bufVal], bufVal.length + 20);
                    adapter.setState(id, enc[1], true); // TODO: here send to ism8

                    adapter._connections.forEach(sock => sock.write(_buff_set));
                } else {
                    adapter.log.error('Can\'t encode DP : ' + dp + ' - data: ' + enc[1] + ' - type: ' + datapoints[dp].type);
                }
            }
        }
    });

    return adapter;
}

function getDevice(dp) {
    dp = parseInt(dp, 10);
    if ((dp >= 1 && dp <= 13) || (dp >= 197 && dp <= 199)) {
        return 'hg1';
    } else if ((dp >= 14 && dp <= 26) || (dp >= 200 && dp <= 202)) {
        return 'hg2';
    } else if ((dp >= 27 && dp <= 39) || (dp >= 203 && dp <= 205)) {
        return 'hg3';
    } else if ((dp >= 40 && dp <= 52) || (dp >= 206 && dp <= 208)) {
        return 'hg4';
    } else if (dp >= 53 && dp <= 66) {
        return 'bm1';
    } else if (dp >= 67 && dp <= 79) {
        return 'bm2';
    } else if (dp >= 80 && dp <= 92) {
        return 'bm3';
    } else if (dp >= 93 && dp <= 105) {
        return 'bm4';
    } else if ((dp >= 106 && dp <= 113) || (dp >= 209 && dp <= 210)) {
        return 'km1';
    } else if (dp >= 114 && dp <= 120) {
        return 'mm1';
    } else if (dp >= 121 && dp <= 127) {
        return 'mm2';
    } else if (dp >= 128 && dp <= 134) {
        return 'mm3';
    } else if ((dp >= 135 && dp <= 147) || (dp >= 195 && dp <= 196)) {
        return 'sm1';
    } else if ((dp >= 148 && dp <= 175) || (dp >= 192 && dp <= 193)) {
        return 'cwl';
    } else if (dp >= 176 && dp <= 191) {
        return 'hg0';
    } else if (dp === 194) {
        return 'bm0';
    } else {
        return null;
    }
}

function getDeviceRage(id) {
    if (id === 'hg1') {
        return {'lsb': 1, 'msb': 13, 'lsb2': 197, 'msb2': 199};
    } else if (id === 'hg2') {
        return {'lsb': 14, 'msb': 26, 'lsb2': 200, 'msb2': 202};
    } else if (id === 'hg3') {
        return {'lsb': 27, 'msb': 39, 'lsb2': 203, 'msb2': 205};
    } else if (id === 'hg4') {
        return {'lsb': 40, 'msb': 52, 'lsb2': 206, 'msb2': 208};
    } else if (id === 'bm1') {
        return {'lsb': 53, 'msb': 66};
    } else if (id === 'bm2') {
        return {'lsb': 67, 'msb': 79};
    } else if (id === 'bm3') {
        return {'lsb': 80, 'msb': 92};
    } else if (id === 'bm4') {
        return {'lsb': 93, 'msb': 105};
    } else if (id === 'km1') {
        return {'lsb': 106, 'msb': 113, 'lsb2': 209, 'msb2': 210};
    } else if (id === 'mm1') {
        return {'lsb': 114, 'msb': 120};
    } else if (id === 'mm2') {
        return {'lsb': 121, 'msb': 127};
    } else if (id === 'mm3') {
        return {'lsb': 128, 'msb': 134};
    } else if (id === 'sm1') {
        return {'lsb': 135, 'msb': 147, 'lsb2': 195, 'msb2': 196};
    } else if (id === 'cwl') {
        return {'lsb': 148, 'msb': 175, 'lsb2': 192, 'msb2': 193};
    } else if (id === 'hg0') {
        return {'lsb': 176, 'msb': 191};
    } else if (id === 'bm0') {
        return {'lsb': 194, 'msb': 194};
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
            return Math.round(dec.decodeDPT9(data) * 100) / 100;
        }

    } else if (type === 'DPT_TimeOfDay') {
        return dec.decodeDPT10(data);
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
        } else if (datapoints[dp].name === 'Programmwahl CWL') {
            if (_data === 0) {
                return 'Automatikbetrieb';
            } else if (_data === 1) {
                return 'Nennlüftung';
            } else if (_data === 3) {
                return 'Reduzierte Lüftung';
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
                throw '';
            }
        } else {
            throw '';
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
    //"DPT_Date"
    //"DPT_Scaling"

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
                return [Buffer.from('00', 'hex'), '0ff'];
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
        return 'error';
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
    if (adapter.config.names[dev + '_n'] === '') {
        if (dev.match(/hg/)) {
            groupName = 'Heizgeräte ' + dev.slice(-1);
        } else if (dev.match(/bm/)) {
            groupName = 'Bediengeräte ' + dev.slice(-1);
        } else if (dev.match(/mm/)) {
            groupName = 'Mischermodule ' + dev.slice(-1);
        } else if (dev.match(/km/)) {
            groupName = 'Kaskadenmodul';
        } else if (dev.match(/sm/)) {
            groupName = 'Solarmodul';
        } else if (dev.match(/cwl/)) {
            groupName = 'Comfort-Wohnungs-Lüftung';
        }
    } else {
        groupName = adapter.config.names[dev + '_n'];
    }

    adapter.setObjectNotExists(dev, {
        type: 'channel',
        common: {
            name: groupName,
            type: 'channel'
        },
        native: {}
    });
}

async function addDevice(dp, callback) {
    const dev = getDevice(dp);
    if (dev) {
        //ack_data.new_devices.push(dev);
        const range = getDeviceRage(dev);

        addGroup(dev);

        for (range.lsb; range.lsb <= range.msb; range.lsb++) {

            if (!ack_data[range.lsb]) {
                const data = datapoints[range.lsb];
                if (data.einheit === 'Pa' && adapter.config.bool_bar) {
                    data.einheit = 'bar';
                }
                if (adapter.config.bool_status && ['DPT_Switch', 'DPT_Enable', 'DPT_OpenClose'].includes(data.type)) {
                    data.commonType = 'boolean';
                }
                ack_data[range.lsb] = {id: adapter.namespace + '.' + dev + '.' + range.lsb};
                //console.log('add:' + dev + '.' + range.lsb  );
                if (data.commonType === 'number') {
                	await adapter.extendObject(dev + '.' + range.lsb, {
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
	                await adapter.extendObject(dev + '.' + range.lsb, {
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

        if (range.lsb2 != null && range.msb2 != null) {
            for (range.lsb2; range.lsb2 <= range.msb2; range.lsb2++) {
                if (!ack_data[range.lsb2]) {
                    const data = datapoints[range.lsb2];
                    if (data.einheit === 'Pa' && adapter.config.bool_bar) {
                        data.einheit = 'bar'
                    }
                    ack_data[range.lsb2] = {id: adapter.namespace + '.' + dev + '.' + range.lsb2};
                    //console.log('add:' + dev + '.' + range.lsb2  );
                    if (data.commonType === 'number') {
	                	await adapter.extendObject(dev + '.' + range.lsb2, {
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
	                    await adapter.extendObject(dev + '.' + range.lsb2, {
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

        callback && callback();
    }
}

function main() {
    adapter.config.bool_bar = adapter.config.bool_bar === true || adapter.config.bool_bar === 'true';
    adapter.getForeignObjects(adapter.namespace + '.*', (err, list) => {
        for (const idd in list) {
            if (list.hasOwnProperty(idd)) {
                ack_data[idd.split('.').pop()] = {id: idd};
                ack_data.old_devices[idd.split('.')[2]] = idd.split('.')[2];
            }
        }

        const devices = adapter.config.devices;
        names = adapter.config.names;

        for (const dev in devices) {
            if (devices.hasOwnProperty(dev) && ack_data.old_devices[dev]) {
                if (devices[dev] === 'off') {
                    adapter.deleteChannel(dev);
                } else {
                    addGroup(dev);
                }
            }
        }

        adapter.subscribeStates('*');

        createServer(adapter);
    });
}

function setState(adapter, dp, val, data, device) {
    try {
        val = decode(datapoints[dp].type, data.slice(20), dp);

        adapter.setState(device + '.' + dp, val, true);
        ack_data[dp]['value'] = val;
    } catch (err) {
        val = '';
        adapter.log.error(`Can't parse DP : ${dp} - data: ${data.toString('hex')} - length: ${data.length}`);
        adapter.log.debug(`incoming Device: ${device}, Datapoint: ${dp}, Datapoint_name: ${datapoints[dp].name}, Datapoint_type: ${datapoints[dp].type}, Data: ${data.toString('hex')}, Length: ${data.length}, Value: ${val}`
        );
    }
}

function createServer(adapter) {
    const buffReq    = Buffer.from('0620F080001104000000F086006E000000', 'hex');
    const buffGetAll = Buffer.from('0620F080001604000000F0D0', 'hex');
    const splitter   = Buffer.from('0620F080', 'hex');

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

        sock.on('error', err => adapter.log.error('Socket error: ' + err.toString()));

        sock.on('data', _data => {
            adapter.log.debug(`Data from ${sock.remoteAddress}:${sock.remotePort}: ${_data.toString('hex')}`);

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
                sock.write(buffReq);

                dp = data.readUInt16BE(12);
                device = getDevice(dp);

                if (adapter.config.devices[device] === 'Auto') {
                    if (ack_data[dp]) {
                        setState(adapter, dp, val, data, device);
                    } else {
                        if (datapoints[dp].name === 'Störung') {
                            if (data.slice(20).readInt8(0) === 1) {
                                ignore[device] = true;
                            } else {
                                ignore[device] = undefined;
                            }
                        }

                        !ignore[device] && addDevice(dp, () =>
                            setState(adapter, dp, val, data, device));
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
    });

    adapter._server.on('error', err => adapter.log.error('Cannot start server: ' + err.toString()));

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
