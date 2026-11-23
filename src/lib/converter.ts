/**
 * Conversion between the values of the ISM8i datapoints and the values of the ioBroker states.
 */
import datapointsJson from './datapoints.json';
import {
    decodeDPT10,
    decodeDPT11,
    decodeDPT13,
    decodeDPT5,
    decodeDPT7,
    decodeDPT9,
    encodeDPT10,
    encodeDPT11,
    encodeDPT5,
    encodeDPT7,
    encodeDPT9,
} from './dpt';
import type { Datapoint, LogFunction, StateValue } from './types';

/** All known datapoints of the ISM8i, key is the datapoint ID */
export const DATAPOINTS = datapointsJson as Record<string, Datapoint>;

/** Types that are written as boolean, if the option "Status as Boolean" is set */
export const BOOLEAN_TYPES: Datapoint['type'][] = ['DPT_Switch', 'DPT_Enable', 'DPT_OpenClose', 'DPT_Bool'];

// Heizgerätetyp, DP 357, 359, 360, 361 (ISM8i manual, 8.7.9)
const BOILER_TYPES: Record<number, string> = {
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
const HEATING_CIRCUITS = [
    'Dir. Heizkreis',
    'Mischerkreis 1',
    'Mischerkreis 2',
    'Mischerkreis 3',
    'Mischerkreis 4',
    'Mischerkreis 5',
    'Mischerkreis 6',
    'Mischerkreis 7',
];
const HOT_WATER_CIRCUITS = [
    'Dir. Warmwasser',
    'Warmwasser 1',
    'Warmwasser 2',
    'Warmwasser 3',
    'Warmwasser 4',
    'Warmwasser 5',
    'Warmwasser 6',
    'Warmwasser 7',
];
// bit -> name. DP 355 and 356: available devices (ISM8i manual, 8.7.8)
const DEVICES_355: Record<number, string> = {
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
const DEVICES_356: Record<number, string> = {
    6: 'CWL Excellent',
    9: 'Solarmodul 1',
    10: 'Solarmodul 2',
    11: 'BM-2 (0) / System',
};
// DPT_HVACContrMode (ISM8i manual, 8.6.10)
const HVAC_CONTR_MODES: Record<number, string> = {
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

interface Program {
    /** number as on the Wolf control unit */
    num: number;
    /** text as the adapter shows it */
    text: string;
    /** value of the datapoint type */
    raw: number;
}

// Programmwahl Warmwasser: number as on the control unit (ISM8i manual, 8.7.4) -> DPT_DHWMode
const PROGRAMS_DHW: Program[] = [
    { num: 0, text: 'Standby', raw: 4 },
    { num: 1, text: 'Automatikbetrieb', raw: 0 },
    { num: 2, text: 'Dauerbetrieb', raw: 2 },
];
// Programmwahl Heizkreis/Mischer: number as on the control unit (ISM8i manual, 8.7.3) -> DPT_HVACMode
const PROGRAMS_HEATING: Program[] = [
    { num: 0, text: 'Standby', raw: 2 },
    { num: 1, text: 'Automatikbetrieb', raw: 0 },
    { num: 2, text: 'Heizbetrieb', raw: 1 },
    { num: 3, text: 'Sparbetrieb', raw: 3 },
];
// Programmwahl CWL: number as DPT_HVACMode value (ISM8i manual, 8.7.5).
// Intentionally different from the other programs: the numbers were always the KNX values here.
const PROGRAMS_CWL: Program[] = [
    { num: 0, text: 'Automatikbetrieb', raw: 0 },
    { num: 1, text: 'Nennlüftung', raw: 1 },
    { num: 3, text: 'Reduzierte Lüftung', raw: 3 },
    { num: 4, text: 'Feuchteschutz', raw: 4 },
];

/** Values of DPT_Switch that mean "on" when writing */
const SWITCH_ON: ioBroker.StateValue[] = ['On', 'on', 'Enable', '1', 'true', 1, true];

/** Returns the names of the set bits, separated by comma. Bits without name are ignored. */
export function decodeBitMask(value: number, names: Record<number, string> | string[]): string {
    const result: string[] = [];
    for (let bit = 0; bit < 16; bit++) {
        const name = (names as Record<number, string>)[bit];
        if (value & (1 << bit) && name) {
            result.push(name);
        }
    }
    return result.join(', ');
}

/** Converts a value to a number. Returns NaN for values that are not numbers or numeric strings. */
function toNumber(value: ioBroker.StateValue): number {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        return Number(value);
    }
    return NaN;
}

/** Limits a numeric value to min...max and rounds it to the step */
function limit(data: ioBroker.StateValue, min: number, max: number, step: number): number {
    const value = toNumber(data);
    if (isNaN(value)) {
        throw new Error(`Invalid number "${String(data)}"`);
    }
    return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** Parses a date. Accepted: "YYYY-MM-DD", "DD.MM.YYYY", everything that Date can parse and timestamps. */
function parseDate(data: ioBroker.StateValue): Date {
    let date: Date;
    const text = typeof data === 'string' ? data.trim() : '';
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
        date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    } else if ((m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
        date = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    } else {
        date = new Date(data as string | number);
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    // DPT 11 can store the years 2000...2089 (the decoder reads 90...99 as 1990...1999)
    if (isNaN(date.getTime()) || date.getFullYear() < 2000 || date.getFullYear() > 2089) {
        throw new Error(`Invalid date "${String(data)}"`);
    }
    return date;
}

/** Parses a time of day. Accepted: "HH:MM", "HH:MM:SS", everything that Date can parse and timestamps. */
function parseTime(data: ioBroker.StateValue): Date {
    const text = typeof data === 'string' ? data.trim() : '';
    const m = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
        const hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        const seconds = parseInt(m[3] || '0', 10);
        if (hours > 23 || minutes > 59 || seconds > 59) {
            throw new Error(`Invalid time "${String(data)}"`);
        }
        const time = new Date();
        time.setHours(hours, minutes, seconds, 0);
        return time;
    }
    const time = new Date(data as string | number);
    if (isNaN(time.getTime())) {
        throw new Error(`Invalid time "${String(data)}"`);
    }
    return time;
}

/**
 * Finds the value of a program selection. A value can be given as number (see the program tables)
 * or as text (as the adapter shows it).
 */
function findProgram(data: ioBroker.StateValue, programs: Program[]): number {
    const num = toNumber(data);
    const program = programs.find(p => p.text === data || p.num === num);
    if (!program) {
        throw new Error(
            `Invalid value "${String(data)}", allowed: ${programs.map(p => `${p.num} or "${p.text}"`).join(', ')}`,
        );
    }
    return program.raw;
}

export interface ConverterOptions {
    /** write DPT_Switch, DPT_Bool, DPT_Enable and DPT_OpenClose as boolean */
    boolStatus: boolean;
    /** write pressures in bar instead of Pa */
    boolBar: boolean;
    /** debug log */
    log: LogFunction;
}

export class Converter {
    public constructor(private readonly options: ConverterOptions) {}

    /** Type of the state of a datapoint */
    public getCommonType(dp: number | string): ioBroker.CommonType {
        const datapoint = DATAPOINTS[dp];
        if (this.options.boolStatus && BOOLEAN_TYPES.includes(datapoint.type)) {
            return 'boolean';
        }
        return datapoint.commonType;
    }

    /** Unit of the state of a datapoint */
    public getUnit(dp: number | string): string | undefined {
        const unit = DATAPOINTS[dp].einheit;
        return this.options.boolBar && unit === 'Pa' ? 'bar' : unit;
    }

    /** Converts the value of a datapoint as received from the ISM8i */
    public decode(dp: number, data: Buffer): StateValue {
        const datapoint = DATAPOINTS[dp];
        const boolStatus = this.options.boolStatus;
        let value: number;

        switch (datapoint.type) {
            case 'DPT_Switch':
                return boolStatus ? data.readInt8(0) !== 0 : data.readInt8(0) === 0 ? 'Off' : 'On';
            case 'DPT_Bool':
                return boolStatus ? data.readInt8(0) !== 0 : data.readInt8(0) === 0 ? 'false' : 'true';
            case 'DPT_Enable':
                return boolStatus ? data.readInt8(0) !== 0 : data.readInt8(0) === 0 ? 'Disable' : 'Enable';
            case 'DPT_OpenClose':
                // Intentionally 0 = Close, 1 = Open, as in all versions of the adapter.
                // The ISM8i manual says 0 = Open, 1 = Close (DPT 1.009).
                return boolStatus ? data.readInt8(0) !== 0 : data.readInt8(0) === 0 ? 'Close' : 'Open';
            case 'DPT_Scaling':
                // DPT 5.001: 0...255 = 0...100 % (ISM8i manual, 8.6.2)
                return Math.round((decodeDPT5(data) * 100) / 255);
            case 'DPT_Value_Pres':
                if (this.options.boolBar) {
                    return Math.round((decodeDPT9(data) / 100000) * 100) / 100;
                }
                return Math.round(decodeDPT9(data) * 100) / 100;
            case 'DPT_Power':
                value = Math.round(decodeDPT9(data) * 100) / 100;
                // Intentionally: values above 999 kW are divided by 1000, as in all versions of the adapter
                return value > 999 ? value / 1000 : value;
            case 'DPT_Value_Temp':
            case 'DPT_Tempd':
            case 'DPT_Value_Volume_Flow':
                return Math.round(decodeDPT9(data) * 100) / 100;
            case 'DPT_TimeOfDay':
                return decodeDPT10(data);
            case 'DPT_Date':
                return decodeDPT11(data);
            case 'DPT_Value_1_Ucount':
                value = decodeDPT5(data);
                if (dp === 357 || dp === 359 || dp === 360 || dp === 361) {
                    // Heizgerätetyp (ISM8i manual, 8.7.9)
                    if (BOILER_TYPES[value] !== undefined) {
                        return BOILER_TYPES[value];
                    }
                    this.options.log(`Unknown boiler type ${value} for DP ${dp}`);
                    return String(value);
                }
                if (dp === 358) {
                    // bit mask of the available hot water circuits
                    return decodeBitMask(value, HOT_WATER_CIRCUITS);
                }
                if (dp === 251) {
                    // bit mask of the available heating/mixer circuits
                    return decodeBitMask(value, HEATING_CIRCUITS);
                }
                return value;
            case 'DPT_Value_2_Ucount':
                // bit masks of the available devices (ISM8i manual, 8.7.8)
                value = decodeDPT7(data);
                if (dp === 355) {
                    return decodeBitMask(value, DEVICES_355);
                }
                if (dp === 356) {
                    return decodeBitMask(value, DEVICES_356);
                }
                return value;
            case 'DPT_FlowRate_m3/h':
                return Math.round((decodeDPT13(data) / 10000) * 100) / 100;
            case 'DPT_ActiveEnergy':
            case 'DPT_ActiveEnergy_kWh':
                return decodeDPT13(data);
            case 'DPT_DHWMode':
                value = data.readUInt8(0);
                if (datapoint.name === 'Programmwahl Warmwasser') {
                    const program = PROGRAMS_DHW.find(p => p.raw === value);
                    if (program) {
                        return program.text;
                    }
                }
                this.options.log(`Unknown DHWMode value ${value} for DP ${dp}`);
                return String(value);
            case 'DPT_HVACMode': {
                value = data.readUInt8(0);
                let programs: Program[];
                if (datapoint.name === 'Programmwahl Heizkreis' || datapoint.name === 'Programmwahl Mischer') {
                    if (value === 4) {
                        // Building Protection (ISM8i manual, 8.7.3)
                        return 'Permanent Kühlen';
                    }
                    programs = PROGRAMS_HEATING;
                } else if (datapoint.name === 'Programmwahl CWL') {
                    programs = PROGRAMS_CWL;
                } else {
                    return 'not defined';
                }
                const program = programs.find(p => p.raw === value);
                if (program) {
                    return program.text;
                }
                this.options.log(`Unknown HVACMode value ${value} for DP ${dp}`);
                return String(value);
            }
            case 'DPT_HVACContrMode':
                // Betriebsart (ISM8i manual, 8.7.1, 8.7.2)
                value = data.readUInt8(0);
                if (value === 7 && dp < 177) {
                    // Test or GLT mode of gas and oil boilers
                    return 'GLT / Test';
                }
                if (HVAC_CONTR_MODES[value] !== undefined) {
                    return HVAC_CONTR_MODES[value];
                }
                this.options.log(`Unknown HVACContrMode value ${value} for DP ${dp}`);
                return String(value);
            case 'DPT_Unknown1':
                return data.readUInt8(0).toString();
            case 'DPT_Unknown2':
                return data.readUInt16BE(0).toString();
            default:
                throw new Error(`Unknown type ${String(datapoint.type)}`);
        }
    }

    /**
     * Encodes a value for the ISM8i.
     *
     * @returns the encoded value and the value for the state (limited and rounded)
     */
    public encode(data: ioBroker.StateValue, dp: number): { buffer: Buffer; value: StateValue } {
        const datapoint = DATAPOINTS[dp];
        const type = datapoint.type;
        const name = datapoint.name;
        let buffer: Buffer;
        // Value for the state. For DPT 9 the limited value is used, because DPT 9 cannot store
        // every value exactly (e.g. 85 is sent as 85.04). Other values are decoded from the buffer.
        let value: number | undefined;

        if (type === 'DPT_Switch') {
            buffer = Buffer.from(SWITCH_ON.includes(data) ? [1] : [0]);
        } else if (type === 'DPT_Scaling') {
            // DPT 5.001: 0...255 = 0...100 % (ISM8i manual, 8.6.2)
            const percent = limit(data, datapoint.min || 0, datapoint.max ?? 100, 1);
            buffer = encodeDPT5(Math.round((percent * 255) / 100));
        } else if (type === 'DPT_Value_1_Ucount') {
            buffer = encodeDPT5(limit(data, 0, 255, 1));
        } else if (type === 'DPT_Value_2_Ucount') {
            buffer = encodeDPT7(limit(data, 0, 65535, 1));
        } else if (type === 'DPT_Tempd' && name === 'Sollwertkorrektur') {
            value = limit(data, -4, 4, 0.5);
            buffer = encodeDPT9(value);
        } else if (type === 'DPT_Tempd' && name === 'Sparfaktor') {
            value = limit(data, 0, 10, 0.5);
            buffer = encodeDPT9(value);
        } else if (name === 'Programmwahl Warmwasser') {
            buffer = Buffer.from([findProgram(data, PROGRAMS_DHW)]);
        } else if (name === 'Programmwahl Mischer' || name === 'Programmwahl Heizkreis') {
            buffer = Buffer.from([findProgram(data, PROGRAMS_HEATING)]);
        } else if (type === 'DPT_HVACMode' && name === 'Programmwahl CWL') {
            buffer = Buffer.from([findProgram(data, PROGRAMS_CWL)]);
        } else if (type === 'DPT_Date') {
            buffer = encodeDPT11(parseDate(data));
        } else if (type === 'DPT_TimeOfDay') {
            // The weekday is not used by the ISM8i
            buffer = encodeDPT10(parseTime(data));
        } else if (
            type === 'DPT_Value_Temp' &&
            (name === 'Warmwassersolltemperatur' ||
                name === 'Kesselsolltemperaturvorgabe' ||
                name === 'Sammlersolltemperaturvorgabe')
        ) {
            // the limits are in datapoints.json (ISM8i manual, 8.8)
            value = limit(data, datapoint.min ?? 0, datapoint.max ?? 100, 1);
            buffer = encodeDPT9(value);
        } else {
            throw new Error('Encoding not supported');
        }

        return { buffer, value: value === undefined ? this.decode(dp, buffer) : value };
    }
}
