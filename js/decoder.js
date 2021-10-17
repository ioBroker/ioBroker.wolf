'use strict';

/**
 * Implements decode methods for dpt types
 */
function Decoder() {
}

/**
 * decode eis 8 / dpt 2 values
 */
Decoder.prototype.decodeDPT2 = function (buffer) {
    return buffer.readUInt8(0) & 0x3;
};

/**
 * decode eis 2 / dpt 3 values
 */
Decoder.prototype.decodeDPT3 = function (buffer) {
    return buffer.readUInt8(0) & 0xf;
};

/**
 * decode eis 13 / dpt 4 values
 */
Decoder.prototype.decodeDPT4 = function (buffer) {
    let value = buffer.readUInt8(0);
    if (value <= 127) {
        value = buffer.toString('ascii', 0);
    } else {
        value = buffer.toString('utf8', 0);
    }
    return value;
};

/**
 * decode eis 14 / dpt 5 values
 */
Decoder.prototype.decodeDPT5 = function (buffer) {
    return buffer.readUInt8(0);
};

/**
 * decode eis 14 / dpt 6 values
 */
Decoder.prototype.decodeDPT6 = function (buffer) {
    return buffer.readInt8(0);
};

/**
 * decode EIS 10 / dpt 7 values
 */
Decoder.prototype.decodeDPT7 = function (buffer) {
    return buffer.readUInt16BE(0);
};

/**
 * decode EIS 10.001 / dpt 8 values
 */
Decoder.prototype.decodeDPT8 = function (buffer) {
    return buffer.readInt16BE(0);
};

/**
 * decode eis 5 / dpt 9 values
 */
Decoder.prototype.decodeDPT9 = function (buffer) {
    let value = buffer.readUInt16BE(0);

    const sign = (value & 0x8000) >> 15;
    const exp = (value & 0x7800) >> 11;
    let mant = (value & 0x07ff);

    if (sign !== 0) {
        mant = -(~(mant - 1) & 0x07ff);
    }
    value = (1 << exp) * 0.01 * mant;
    return value;
};

/**
 * decode eis 3 / dpt 10 values
 */
Decoder.prototype.decodeDPT10 = function (buffer) {
    const value = new Date();

    const weekDay = (buffer[0] & 0xe0) >> 5;
    const hour = buffer[0] & 0x1f;
    const min = buffer[1] & 0x3f;
    const sec = buffer[2] & 0x3f;

    value.setHours(hour);
    value.setMinutes(min);
    value.setSeconds(sec);
    const currentDay = value.getDay();
    if (weekDay === 0) {
        // no change
    } else if (currentDay === weekDay) {
        // weekday fits
        if (value < Date.now()) {
            // same weekday but earlier time => date must be one week later
            value.setDate(value.getDate() + 7);
        }
    } else {
        // wrong weekday
        if (currentDay < weekDay) {
            // later weekday
            value.setDate(value.getDate() - currentDay + weekDay);
        } else {
            // earlier weekday => weekday one week later
            value.setDate(value.getDate() - currentDay + weekDay + 7);
        }
    }
    return value.toUTCString();
};

/**
 * decode eis 4 / dpt 11 values
 */
Decoder.prototype.decodeDPT11 = function (buffer) {

    const day = buffer[0] & 0x1f;
    const mon = (buffer[1] & 0xf) - 1; // month 0...11
    let year = buffer[2] & 0x7f;

    if (year < 90) {
        year += 2000;
    } else {
        year += 1900;
    }

    return new Date(year, mon, day).toUTCString();
};

/**
 * decode eis 11 / dpt 12 values
 */
Decoder.prototype.decodeDPT12 = function (buffer) {
    return buffer.readUInt32BE(0);
};

/**
 * decode eis 11.001 / dpt 13 values
 */
Decoder.prototype.decodeDPT13 = function (buffer) {
    return buffer.readInt32BE(0);
};

/**
 * decode eis 9 / dpt 14 values
 */
Decoder.prototype.decodeDPT14 = function (buffer) {
    return buffer.readFloatBE(0);
};

Decoder.prototype.decodeDPT16 = function (buffer) {
    let value = '';
    for (let i = 0; i < buffer.length; i++) {
        value += String.fromCharCode(buffer.readUInt8(i));
    }
    return value;
};

/**
 * decode value
 */
Decoder.prototype.decode = function (len, data, callback) {
    let err = null;
    let type = 'DPT1';
    let value = null;

    // eis 1 / dpt 1.xxx
    if (len === 8) {
        value = data - 64;
        if (value > 1) {
            value = value - 64;
        }
    }

    // eis 6 / dpt 5.xxx
    // assumption
    if (len === 9) {
        type = 'DPT5';
        if (data.length === 1) {
            value = this.decodeDPT5(data);
        } else {
            err = new Error('Invalid data len for DPT5');
        }
    }

    // eis 5 / dpt 9.xxx
    // assumption
    if (len === 10) {
        type = 'DPT9';
        if (data.length === 2) {
            value = this.decodeDPT9(data);
        }
        else {
            err = new Error('Invalid data len for DPT9');
        }
    }

    if (callback) {
        callback(err, type, value);
    }
};

module.exports = Decoder;
