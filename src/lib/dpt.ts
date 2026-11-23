/**
 * Encoding and decoding of the KNX datapoint types used by the ISM8i (ISM8i manual, chapter 8.6).
 * Only the types that the ISM8i uses are implemented.
 */

/** DPT 5: 8 bit unsigned */
export function decodeDPT5(buffer: Buffer): number {
    return buffer.readUInt8(0);
}

/** DPT 7: 16 bit unsigned */
export function decodeDPT7(buffer: Buffer): number {
    return buffer.readUInt16BE(0);
}

/** DPT 9: float value = 0.01 * mantissa * 2^exponent */
export function decodeDPT9(buffer: Buffer): number {
    const value = buffer.readUInt16BE(0);

    const sign = (value & 0x8000) >> 15;
    const exp = (value & 0x7800) >> 11;
    let mant = value & 0x07ff;

    if (sign !== 0) {
        mant = -(~(mant - 1) & 0x07ff);
    }
    return (1 << exp) * 0.01 * mant;
}

/**
 * DPT 10: time of day.
 * Returns the next point in time with this time and weekday (or today, if no weekday is set) as UTC string.
 */
export function decodeDPT10(buffer: Buffer): string {
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
        if (value.getTime() < Date.now()) {
            // same weekday but earlier time => date must be one week later
            value.setDate(value.getDate() + 7);
        }
    } else if (currentDay < weekDay) {
        // later weekday
        value.setDate(value.getDate() - currentDay + weekDay);
    } else {
        // earlier weekday => weekday one week later
        value.setDate(value.getDate() - currentDay + weekDay + 7);
    }
    return value.toUTCString();
}

/**
 * DPT 11: date. Returns the local midnight of this day as UTC string.
 * The years 0...89 are 2000...2089, 90...99 are 1990...1999.
 */
export function decodeDPT11(buffer: Buffer): string {
    const day = buffer[0] & 0x1f;
    const mon = (buffer[1] & 0xf) - 1; // month 0...11
    let year = buffer[2] & 0x7f;

    if (year < 90) {
        year += 2000;
    } else {
        year += 1900;
    }

    return new Date(year, mon, day).toUTCString();
}

/** DPT 13: 32 bit signed */
export function decodeDPT13(buffer: Buffer): number {
    return buffer.readInt32BE(0);
}

/** DPT 5: 8 bit unsigned */
export function encodeDPT5(value: number): Buffer {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value & 0xff, 0);
    return buffer;
}

/** DPT 7: 16 bit unsigned */
export function encodeDPT7(value: number): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(value & 0xffff, 0);
    return buffer;
}

/**
 * DPT 9: float value = 0.01 * mantissa * 2^exponent.
 * The smallest exponent is used, with which the mantissa fits into -2048...2047.
 */
export function encodeDPT9(value: number): Buffer {
    let exp = 0;
    let mant = Math.round(value * 100);
    while ((mant < -2048 || mant > 2047) && exp < 15) {
        exp++;
        mant = Math.round((value * 100) / (1 << exp));
    }
    if (mant < -2048 || mant > 2047) {
        throw new Error(`Value ${value} is out of range for DPT 9`);
    }

    let data = (exp & 0x0f) << 11;
    if (mant < 0) {
        // sign bit and mantissa in two's complement notation
        data |= 0x8000 | (mant & 0x07ff);
    } else {
        data |= mant;
    }

    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(data, 0);
    return buffer;
}

/** DPT 10: time of day, the weekday is optional (1 = Monday ... 7 = Sunday) */
export function encodeDPT10(date: Date, weekday?: number): Buffer {
    let hour = date.getHours();
    if (weekday) {
        hour += weekday << 5;
    }

    const buffer = Buffer.alloc(3);
    buffer.writeUInt8(hour, 0);
    buffer.writeUInt8(date.getMinutes(), 1);
    buffer.writeUInt8(date.getSeconds(), 2);
    return buffer;
}

/** DPT 11: date */
export function encodeDPT11(date: Date): Buffer {
    const buffer = Buffer.alloc(3);

    buffer.writeUInt8(date.getDate() & 0x1f, 0);
    buffer.writeUInt8((date.getMonth() + 1) & 0xf, 1);
    buffer.writeUInt8((date.getFullYear() - 2000) & 0x7f, 2);

    return buffer;
}
