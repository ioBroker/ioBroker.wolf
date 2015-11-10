//﻿'use strict';

var net = require('net');
var utils = require(__dirname + '/lib/utils');
var adapter = utils.adapter('wolf');


var dec = new (require('./js/decoder.js'))();
var datapoints = require('./js/datapoints.json');

var names = ""
var ack_data = {
    old_devices: {},
    new_devices: []
};
var ignore = {

};

function getDevice(dp) {
    if (dp >= 1 && dp <= 13) {
        return 'hg1'
    } else if (dp >= 14 && dp <= 26) {
        return 'hg2'
    } else if (dp >= 27 && dp <= 39) {
        return 'hg3'
    } else if (dp >= 40 && dp <= 52) {
        return 'hg4'
    } else if (dp >= 53 && dp <= 66) {
        return 'bm1'
    } else if (dp >= 67 && dp <= 79) {
        return 'bm2'
    } else if (dp >= 80 && dp <= 92) {
        return 'bm3'
    } else if (dp >= 93 && dp <= 105) {
        return 'bm4'
    } else if (dp >= 106 && dp <= 113) {
        return 'km1'
    } else if (dp >= 114 && dp <= 120) {
        return 'mm1'
    } else if (dp >= 121 && dp <= 127) {
        return 'mm2'
    } else if (dp >= 128 && dp <= 134) {
        return 'mm3'
    } else if (dp >= 135 && dp <= 147) {
        return 'sm1'
    } else if (dp >= 148 && dp <= 175) {
        return 'cwl'
    } else if (dp >= 176 && dp <= 191) {
        return 'hg0'
    } else {
        return null;
    }
}

function getDeviceRage(id) {
    if (id == 'hg1') {
        return {'lsb': 1, 'msb': 13}
    } else if (id == 'hg2') {
        return {'lsb': 14, 'msb': 26}
    } else if (id == 'hg3') {
        return {'lsb': 27, 'msb': 39}
    } else if (id == 'hg4') {
        return {'lsb': 40, 'msb': 52}
    } else if (id == 'bm1') {
        return {'lsb': 53, 'msb': 66}
    } else if (id == 'bm2') {
        return {'lsb': 67, 'msb': 79}
    } else if (id == 'bm3') {
        return {'lsb': 80, 'msb': 92}
    } else if (id == 'bm4') {
        return {'lsb': 93, 'msb': 105}
    } else if (id == 'km1') {
        return {'lsb': 106, 'msb': 113}
    } else if (id == 'mm1') {
        return {'lsb': 114, 'msb': 120}
    } else if (id == 'mm2') {
        return {'lsb': 121, 'msb': 127}
    } else if (id == 'mm3') {
        return {'lsb': 128, 'msb': 134}
    } else if (id == 'sm1') {
        return {'lsb': 135, 'msb': 147}
    } else if (id == 'cwl') {
        return {'lsb': 148, 'msb': 175}
    } else if (id == 'hg0') {
        return {'lsb': 176, 'msb': 191}
    } else {
        return false
    }

}

function decode(type, data, dp) {
    var val;
    var _data;

    if (type == 'DPT_Switch') {
        val = data.readInt8(0);
        if (val == 0) {
            return 'Off'
        } else {
            return 'On'
        }
    } else if (type == 'DPT_Bool') {

        val = data.readInt8(0);
        if (val == 0) {
            return 'false'
        } else {
            return 'true'
        }
    } else if (type == 'DPT_Enable') {
        val = data.readInt8(0);
        if (val == 0) {
            return 'Disable'
        } else {
            return 'Enable'
        }
    } else if (type == 'DPT_OpenClose') {
        val = data.readInt8(0);
        if (val == 0) {
            return 'Open'
        } else {
            return 'On'
        }
    } else if (type == 'DPT_Scaling') {
        return dec.decodeDPT5(data)
    } else if (type == 'DPT_Value_Temp' || type == 'DPT_Tempd' || type == 'DPT_Value_Pres' || type == 'DPT_Power' || type == 'DPT_Value_Volume_Flow'  ) {
        return Math.round(dec.decodeDPT9(data) * 100) / 100
    } else if (type == 'DPT_TimeOfDay') {
        return dec.decodeDPT10(data)
    } else if (type == 'DPT_Date') {
        return dec.decodeDPT11(data)
    } else if (type == 'DPT_FlowRate_m3/h') {
        return dec.decodeDPT13(data)
    } else if (type == 'DPT_DHWMode') {
        _data = data.readInt8(0);
        if (datapoints[dp].name == "Programmwahl Warmwasser") {
            if (_data == 0) {
                return "Automatikbetrieb"
            } else if (_data == 2) {
                return "Dauerbetrieb"
            } else if (_data == 4) {
                return "Standby"
            } else {
                throw "";
            }
        } else if (datapoints[dp].name == "Programmwahl CWL") {
            if (_data == 0) {
                return "Automatikbetrieb"
            } else if (_data == 1) {
                return "Nennlüftung"
            } else if (_data == 3) {
                return "Reduzierte Lüftung"
            } else {
                throw "";
            }
        } else {
            throw "";
        }

    }
    else if (type == 'DPT_HVACMode') {
        _data = data.readInt8(0);

        if (datapoints[dp].name == "Programmwahl Heizkreis" || datapoints[dp].name == "Programmwahl Mischer") {
            if (_data == 2) {
                return "Standby"
            } else if (_data == 0) {
                return "Automatikbetrieb"
            } else if (_data == 1) {
                return "Heizbetrieb"
            } else if (_data == 3) {
                return "Sparbetrieb"
            } else {
                throw "";
            }
        } else {
            throw "";
        }
    } else if (type == 'DPT_HVACContrMode') {
        _data = data.readInt8(0);
        if (dp < 177) {
            if (_data == 0) {
                return "Auto"
            } else if (_data == 1) {
                return "Heat"
            } else if (_data == 6) {
                return "Off"
            } else if (_data == 7) {
                return "Test"
            } else if (_data == 11) {
                return "Ice"
            } else if (_data == 15) {
                return "calibrations Mode"
            } else {
                throw "";
            }
        } else {
            if (_data == 0) {
                return "Auto"
            } else if (_data == 1) {
                return "Heat"
            } else if (_data == 3) {
                return "Cool"
            } else if (_data == 6) {
                return "Off"
            } else if (_data == 7) {
                return "Test"
            } else if (_data == 11) {
                return "Ice"
            } else {
                throw "";
            }
        }
    } else {
        throw "";
    }
}

function bufferIndexOf(buf, search, offset) {
    offset = offset || 0;

    var m = 0;
    var s = -1;
    for (var i = offset; i < buf.length; ++i) {

        if (buf[i] != search[m]) {
            s = -1;
            m = 0;
        }

        if (buf[i] == search[m]) {
            if (s == -1) s = i;
            ++m;
            if (m == search.length) break;
        }
    }

    if (s > -1 && buf.length - s < search.length) return -1;
    return s;
}

function addGroup(dev) {
    var group_name = '';
    if (adapter.config.names[dev+"_n"] == "") {
        if (dev.match(/hg/)) {
            group_name = 'Heizgeräte ' + dev.slice(-1)
        } else if (dev.match(/bm/)) {
            group_name = 'Bediengeräte ' + dev.slice(-1)
        } else if (dev.match(/mm/)) {
            group_name = 'Mischermodule ' + dev.slice(-1)
        } else if (dev.match(/km/)) {
            group_name = 'Kaskadenmodul'
        } else if (dev.match(/sm/)) {
            group_name = 'Solarmodul'
        } else if (dev.match(/cwl/)) {
            group_name = 'Comfort-Wohnungs-Lüftung'
        }
    } else {
        group_name = adapter.config.names[dev+"_n"];
    }

    adapter.setObject(dev, {
        type: 'channel',
        common: {
            name: group_name,
            type: 'channel'
        },
        native: {}
    });
}

function addDevice(dp, callback) {
    var dev = getDevice(dp)
    if (dev) {
        //ack_data.new_devices.push(dev);
        var range = getDeviceRage(dev);


        addGroup(dev)


        for (range.lsb; range.lsb <= range.msb; range.lsb++) {

            if (!ack_data[range.lsb]) {
                var data = datapoints[range.lsb];
                ack_data[range.lsb] = {id: adapter.namespace + "." + dev + '.' + range.lsb};
                //console.log('add:' + dev + '.' + range.lsb  );
                adapter.setObject(dev + '.' + range.lsb, {
                    type: 'state',
                    common: {
                        name: data.name,
                        role: data.type.replace('DPT_', ''),
                        type: 'state',
                        unit: data.einheit,
                        enabled: false
                    },
                    native: {
                        rw: data.rw
                    }
                });
            }
        }
        callback()
    }

}

function main() {

    adapter.getForeignObjects(adapter.namespace + '.*', function (err, list) {

        for (var idd in list) {

            ack_data[idd.split('.').pop()] = {id: idd};
            ack_data.old_devices[idd.split('.')[2]] = idd.split('.')[2];
        }

        var devices = adapter.config.devices;
        names = adapter.config.names;

        for (var dev in devices) {
            if (ack_data.old_devices[dev]) {
                if (devices[dev] == "off") {
                    adapter.deleteChannel(dev, function () {
                    });
                } else {
                    addGroup(dev)
                }
            }
        }

        adapter.subscribeStates('*');

        server();
    });
}

function server() {
    var buff_req = new Buffer("0620F080001104000000F086006E000000", "hex");
    var buff_getall = new Buffer("0620F080001604000000F0D0", "hex");
    var splitter = new Buffer("0620f080", "hex");

    net.createServer(function (sock) {

        var buff_set = new Buffer("0620F080001504000000F006003B00010087030101", "hex");
        //0620F080001504000000F006006E0001006E030101
        adapter.on('stateChange', function (id, state) {
            if (state && !state.ack && id) {
                var dp = id.split('.').pop();
                if (datapoints[dp].rw == "r") {
                    adapter.setState(id, ack_data[dp].value, true);
                    adapter.log.error("oid: " + id + " is only readable")
                } else {

                    //adapter.setState(id, ack_data[dp].value, true); // todo hier an ism8 senden

                    //sock.write(buff_set)
                }
            }
        });


        var val;
        var dp;
        var device;
        var search;
        var lines;
        var data;
        sock.on('data', function (_data) {

            search = -1;
            lines = [];


            while ((search = bufferIndexOf(_data, splitter)) > -1) {
                lines.push(_data.slice(0, search + splitter.length));
                _data = _data.slice(search + splitter.length, _data.length);
            }

            if (_data.length) lines.push(_data);

            for (var i = 1; i < lines.length; i++) {

                data = Buffer.concat([splitter, lines[i]]);

                buff_req[12] = data[12];
                buff_req[13] = data[13];
                sock.write(buff_req);


                dp = data.readUInt16BE(12);
                device = getDevice(dp);
                if (adapter.config.devices[device] == "Auto")
                    if (ack_data[dp]) {
                        setState()
                    } else {
                        if(datapoints[dp].name == "Störung"  ){
                            if(data.slice(20).readInt8(0) == 1){
                                ignore[device] = true;
                            }else{
                                ignore[device]= undefined;
                            }
                        }

                        if (!ignore[device]){
                            addDevice(dp, function () {
                                setState()
                            })
                        }
                    }


                function setState() {
                    try {
                        val = decode(datapoints[dp].type, data.slice(20), dp);

                        adapter.setState(device + '.' + dp, val, true);
                        ack_data[dp]["value"] = val;

                        if(datapoints[dp].type == "DPT_Power" || datapoints[dp].type == "DPT_Value_Volume_Flow"  ){
                            adapter.log.info('incomming' +
                                '\n Device: ' + device +
                                '\n Datapoint: ' + dp +
                                '\n Datapoint_name: ' + datapoints[dp].name +
                                '\n Datapoint_type: ' + datapoints[dp].type +
                                '\n Data: ' + data.toString("hex") +
                                '\n Lengh: ' + data.length +
                                '\n Value: ' + val +
                                ''
                            );
                        }
                    }
                    catch (err) {
                        val = "";
                        adapter.log.error("Can't parse DP : " + dp + " - data: " + data.toString("hex") + " - length: " + data.length);
                        adapter.log.debug('incomming' +
                            '\n Device: ' + device +
                            '\n Datapoint: ' + dp +
                            '\n Datapoint_name: ' + datapoints[dp].name +
                            '\n Datapoint_type: ' + datapoints[dp].type +
                            '\n Data: ' + data.toString("hex") +
                            '\n Lengh: ' + data.length +
                            '\n Value: ' + val +
                            ''
                        );
                    }
                }
            }
        })

        sock.write(buff_getall);
    }).listen(adapter.config.ism8_port, adapter.config.host_ip);
}

adapter.on('ready', function () {
    main();
});


//function test(_data) {
//    var _data = new Buffer("0620f080001504000000f00600020001000203010b", "hex");
//    var val;
//    var dp = _data.readUInt16BE(12);
//    var device = getDevice(dp);
//
//
//    try {
//        val = decode(datapoints[dp].type, _data.slice(20), dp);
//    }
//    catch (err) {
//        val = "";
//        console.log("Can't parse DP : " + dp + " - data: " + _data.toString("hex") + " - length: " + _data.length)
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

//todo DPT_HVACContrMode 0620f080001504000000f00600020001000203010b
//todo DPT_HVACContrMode 0620f080001504000000f006000200010002030101