import type { DatapointRange, DeviceId } from './types';

/** All channels the adapter creates */
export const DEVICE_IDS: DeviceId[] = [
    'hg0_t',
    'hg1_t',
    'hg2_t',
    'hg3_t',
    'hg4_t',
    'bm1_t',
    'bm2_t',
    'bm3_t',
    'bm4_t',
    'km1_t',
    'mm1_t',
    'mm2_t',
    'mm3_t',
    'sm1_t',
    'cwl_t',
    'unknown',
];

/**
 * Returns the channel of a datapoint (ISM8i manual, chapter 8.3).
 * Must describe the same datapoints as getDeviceRanges().
 */
export function getDevice(dp: number): DeviceId | null {
    if ((dp >= 1 && dp <= 13) || (dp >= 197 && dp <= 199) || dp === 364) {
        return 'hg1_t';
    }
    if ((dp >= 14 && dp <= 26) || (dp >= 200 && dp <= 202) || dp === 365) {
        return 'hg2_t';
    }
    if ((dp >= 27 && dp <= 39) || (dp >= 203 && dp <= 205) || dp === 366) {
        return 'hg3_t';
    }
    if ((dp >= 40 && dp <= 52) || (dp >= 206 && dp <= 208) || dp === 367) {
        return 'hg4_t';
    }
    if ((dp >= 53 && dp <= 66) || dp === 194 || dp === 368 || (dp >= 355 && dp <= 361) || dp === 251 || dp === 372) {
        return 'bm1_t';
    }
    if ((dp >= 67 && dp <= 79) || dp === 369) {
        return 'bm2_t';
    }
    if ((dp >= 80 && dp <= 92) || dp === 370) {
        return 'bm3_t';
    }
    if ((dp >= 93 && dp <= 105) || dp === 371) {
        return 'bm4_t';
    }
    if ((dp >= 106 && dp <= 113) || (dp >= 209 && dp <= 211)) {
        return 'km1_t';
    }
    if (dp >= 114 && dp <= 120) {
        return 'mm1_t';
    }
    if (dp >= 121 && dp <= 127) {
        return 'mm2_t';
    }
    if (dp >= 128 && dp <= 134) {
        return 'mm3_t';
    }
    if ((dp >= 135 && dp <= 147) || (dp >= 195 && dp <= 196)) {
        return 'sm1_t';
    }
    if ((dp >= 148 && dp <= 175) || (dp >= 192 && dp <= 193)) {
        return 'cwl_t';
    }
    if (dp >= 176 && dp <= 191) {
        return 'hg0_t';
    }
    if (dp >= 336 && dp <= 354) {
        return 'unknown';
    }
    return null;
}

/** Returns the datapoint ranges of a channel. Must describe the same datapoints as getDevice(). */
export function getDeviceRanges(id: string): DatapointRange[] {
    switch (id) {
        case 'hg1_t':
            return [
                { lsb: 1, msb: 13 },
                { lsb: 197, msb: 199 },
                { lsb: 364, msb: 364 },
            ];
        case 'hg2_t':
            return [
                { lsb: 14, msb: 26 },
                { lsb: 200, msb: 202 },
                { lsb: 365, msb: 365 },
            ];
        case 'hg3_t':
            return [
                { lsb: 27, msb: 39 },
                { lsb: 203, msb: 205 },
                { lsb: 366, msb: 366 },
            ];
        case 'hg4_t':
            return [
                { lsb: 40, msb: 52 },
                { lsb: 206, msb: 208 },
                { lsb: 367, msb: 367 },
            ];
        case 'bm1_t':
            return [
                { lsb: 53, msb: 66 },
                { lsb: 194, msb: 194 },
                { lsb: 251, msb: 251 },
                { lsb: 355, msb: 361 },
                { lsb: 368, msb: 368 },
                { lsb: 372, msb: 372 },
            ];
        case 'bm2_t':
            return [
                { lsb: 67, msb: 79 },
                { lsb: 369, msb: 369 },
            ];
        case 'bm3_t':
            return [
                { lsb: 80, msb: 92 },
                { lsb: 370, msb: 370 },
            ];
        case 'bm4_t':
            return [
                { lsb: 93, msb: 105 },
                { lsb: 371, msb: 371 },
            ];
        case 'km1_t':
            return [
                { lsb: 106, msb: 113 },
                { lsb: 209, msb: 211 },
            ];
        case 'mm1_t':
            return [{ lsb: 114, msb: 120 }];
        case 'mm2_t':
            return [{ lsb: 121, msb: 127 }];
        case 'mm3_t':
            return [{ lsb: 128, msb: 134 }];
        case 'sm1_t':
            return [
                { lsb: 135, msb: 147 },
                { lsb: 195, msb: 196 },
            ];
        case 'cwl_t':
            return [
                { lsb: 148, msb: 175 },
                { lsb: 192, msb: 193 },
            ];
        case 'hg0_t':
            return [{ lsb: 176, msb: 191 }];
        case 'unknown':
            return [{ lsb: 336, msb: 354 }];
        default:
            return [];
    }
}

/**
 * Datapoints 212...354 (without 251) are processed even if no device is configured for them.
 * 336...354 are in the channel "unknown", the others are not in datapoints.json.
 */
export function isAlwaysProcessed(dp: number): boolean {
    return (dp >= 212 && dp <= 250) || (dp >= 252 && dp <= 354);
}

/** Default name of a channel, if no name is configured */
export function getDefaultChannelName(dev: string): string {
    const num = dev.slice(-3, -2);
    if (dev.startsWith('hg')) {
        return `Heizgerät ${num}`;
    }
    if (dev.startsWith('bm')) {
        return `Bediengerät ${num}`;
    }
    if (dev.startsWith('mm')) {
        return `Mischermodul ${num}`;
    }
    if (dev.startsWith('km')) {
        return 'Kaskadenmodul';
    }
    if (dev.startsWith('sm')) {
        return 'Solarmodul';
    }
    if (dev.startsWith('cwl')) {
        return 'Comfort-Wohnungs-Lüftung';
    }
    return 'Unbekannte Datenpunkte';
}
