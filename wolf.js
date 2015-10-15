//﻿'use strict';

// todo schreiben


var net = require('net');
//var utils = require(__dirname + '/lib/utils');
//var adapter = utils.adapter('wolf');


var dec = new (require('./js/decoder.js'))();
var datapoints = require('./js/datapoints.json');

var ack_data = {
    old_devices: {},
    new_devices: []
};

function get_device(id) {
    if (id >= 1 && id <= 13) {
        return 'hg1'
    } else if (id >= 14 && id <= 26) {
        return 'hg2'
    } else if (id >= 27 && id <= 39) {
        return 'hg3'
    } else if (id >= 40 && id <= 52) {
        return 'hg4'
    } else if (id >= 53 && id <= 66) {
        return 'bm1'
    } else if (id >= 67 && id <= 79) {
        return 'bm2'
    } else if (id >= 80 && id <= 92) {
        return 'bm3'
    } else if (id >= 93 && id <= 105) {
        return 'bm4'
    } else if (id >= 106 && id <= 113) {
        return 'km1'
    } else if (id >= 114 && id <= 120) {
        return 'mm1'
    } else if (id >= 121 && id <= 127) {
        return 'mm2'
    } else if (id >= 128 && id <= 134) {
        return 'mm3'
    } else if (id >= 135 && id <= 147) {
        return 'sm1'
    } else if (id >= 148 && id <= 175) {
        return 'cwl'
    } else if (id >= 176 && id <= 191) {
        return 'hg0'
    } else {
        return parseInt(id);
    }
}

function get_device_rage(id) {
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

    if (type == 'DPT_Switch') {
        var val = data.readInt8(0);
        if (val == 0) {
            return 'Off'
        } else {
            return 'On'
        }
    } else if (type == 'DPT_Bool') {

        var val = data.readInt8(0);
        if (val == 0) {
            return 'false'
        } else {
            return 'true'
        }
    } else if (type == 'DPT_Enable') {
        var val = data.readInt8(0);
        if (val == 0) {
            return 'Disable'
        } else {
            return 'Enable'
        }
    } else if (type == 'DPT_OpenClose') {
        var val = data.readInt8(0);
        if (val == 0) {
            return 'Open'
        } else {
            return 'On'
        }
    } else if (type == 'DPT_Scaling') {
        return dec.decodeDPT5(data)
    } else if (type == 'DPT_Value_Temp' || type == 'DPT_Tempd' || type == 'DPT_Value_Pres' || type == 'DPT_Power' || type == 'DPT_Value_Volume_Flow') {
        return Math.round(dec.decodeDPT9(data) * 100) / 100
    } else if (type == 'DPT_TimeOfDay') {
        return dec.decodeDPT10(data)
    } else if (type == 'DPT_Date') {
        return dec.decodeDPT11(data)
    } else if (type == 'DPT_FlowRate_m3/h') {
        return dec.decodeDPT13(data)
    } else if (type == 'DPT_HVACMode') {
        var _data = data.readInt8();

        if (datapoints[dp].name == "Programmwahl Heizkreis" || datapoints[dp].name == "Mischer") {
            if (_data == 2) {
                return "Standby"
            } else if (_data == 0) {
                return "Automatikbetrieb"
            } else if (_data == 2) {
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
        var _data = parseInt(data);

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
    offset = offset || 0

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

function read_from_ism8(_data) {
    var val;
    var search = -1;
    var lines = [];
    var splitter = new Buffer("0620f080", "hex");

    while ((search = bufferIndexOf(_data, splitter)) > -1) {
        lines.push(_data.slice(0, search));
        _data = _data.slice(search + splitter.length, _data.length);
    }

    if (_data.length) lines.push(_data);

    for (var i = 1; i < lines.length; i++) {
        var dp = lines[i].readUInt16BE(8);
        var device = get_device(dp);

        try {
            val = decode(datapoints[dp].type, lines[i].slice(14), dp);
        }
        catch (err) {
            val = "";
            adapter.log.error("Can't parse DP : " + dp + " - data: " + _data.toString("hex") + " - length: " + _data.length);
            //console.log("Can't parse DP : " + dp + " - data: " + lines[i].toString("hex") + " - length: " + lines[i].length);
            //console.log(err)
        }

        try {
            adapter.setState(device + '.' + dp, val, true);
            ack_data[dp]["value"] = val;
        }
        catch (err) {
            adapter.log.error("Can't set DP " + dp);
            adapter.log.error(err)
        }

        //console.log('-----------------------------------------');
        //console.log('Device: ' + device);
        //console.log('Datapoint: ' + dp);
        //console.log('Datapoint_name: ' + datapoints[dp].name);
        //console.log('Datapoint_type: ' + datapoints[dp].type);
        //console.log('value: ' + val);
        //console.log('oid: ' + device + '.' + dp);
    }
}

function main() {

    adapter.getForeignObjects(adapter.namespace + '.*', function (err, list) {

//console.log(list)
        for (var idd in list) {

            ack_data[idd.split('.').pop()] = {id: idd}
            ack_data.old_devices[idd.split('.')[2]] = idd.split('.')[2];
        }

        var devices = adapter.config.devices;
        var names = adapter.config.names;

        var buff_req = new Buffer("0620F080001504000000F086006E000000","hex");
        var buff_getall = new Buffer("0620F080001604000000F0D0","hex");


        for (var group in devices) {
            var parent = false;
            for (var dev in devices[group]) {


                if (devices[group][dev] == 'on') {
                    ack_data.new_devices.push(dev);
                    var range = get_device_rage(dev);

                    if (parent == false) {  //todo muss das parent sein ?
                        parent = true;
                        var group_name = '';

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
                    }

                    adapter.setObject(dev, {
                        type: 'channel',
                        common: {
                            name: names[dev + '_n'] || group_name,
                            type: 'channel'
                        },
                        native: {}
                    });


                    for (range.lsb; range.lsb <= range.msb; range.lsb++) {

                        if (!ack_data[range.lsb]) {
                            var data = datapoints[range.lsb];
                            ack_data[range.lsb] = {id: adapter.namespace + "." + dev + '.' + range.lsb}
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
                }
            }
        }


        for (var dev in ack_data.old_devices) {
            if (ack_data.new_devices.indexOf(dev) == -1) {
                //console.log('delete ' + dev)
                adapter.deleteChannel(dev, function () {
                });
                var range = get_device_rage();
                for (range.lsb; range.lsb <= range.msb; range.lsb++) {
                    delete ack_data[range.lsb]
                }
            }
        }


        net.createServer(function (sock) {

            var val = "";
            sock.write(buff_getall);

            //sock.on('connect', function (e) {
            //    console.log(e)
            //});

            sock.on('data', function (_data) {

                buff_req[12] = _data[12];
                buff_req[13] = _data[13];
                sock.write(buff_req);

                read_from_ism8(_data)

            })
        }).listen(adapter.config.ism8_port, adapter.config.host_ip);

        adapter.subscribeStates('*');
        adapter.on('stateChange', function (id, state) {
            if (state && !state.ack && id) {
                var dp = id.split('.').pop();
                if (datapoints[dp].rw == "r") {
                    adapter.setState(id, ack_data[dp].value, true);
                    adapter.log.error("oid: " + id + " is only readable")
                } else {
                    adapter.setState(id, ack_data[dp].value, true); // todo hier an ism8 senden
                }

            }

        });
    });
}


adapter.on('ready', function () {
    main();
});


// todo 0620f080001504000000f006000b0001000b0301010620f080001504000000f006000c0001000c030100
// todo
// todo 0620f080001504000000f00600bd000100bd030100
// todo
// todo 0620f080001504000000f00600bb000100bb0301010620f080001504000000f00600bc000100bc0301000620f080001504000000f00600bd000100bd030100
// todo 0620f080001504000000f00600ba000100ba0301010620f080001504000000f00600bb000100bb0301010620f080001504000000f00600bc000100bc0301000620f080001504000000f00600bd000100bd03010
// todo
// todo
// todo  0620f080001504000000f006003900010039030100
// todo    0620f080001504000000f006003a0001003a030100
// todo
// todo
// todo   0620f080001604000000f00600410001004103020190
// todo   0620f080001504000000f006004000010040030100
// todo   0620f080001604000000f00600420001004203020190
// todo   0620f080001504000000f006004300010043030100
// todo   0620f080001504000000f006004600010046030100

//read_from_ism8(new Buffer("0620f080001504000000f00600bb000100bb0301010620f080001504000000f00600bc000100bc0301000620f080001504000000f00600bd000100bd030100", "hex"))
