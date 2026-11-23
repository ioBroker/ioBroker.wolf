/**
 * Telegrams of the ISM8i (ISM8i manual, chapter 8.2).
 *
 * Every telegram starts with the KNXnet/IP header 06 20 F0 80, followed by the frame size (2 bytes),
 * the connection header 04 00 00 00 and the ObjectServer message.
 */
import type { LogFunction, ParsedTelegram, TelegramDatapoint } from './types';

/** KNXnet/IP header: header size, version, ObjectServer request */
export const HEADER = Buffer.from('0620F080', 'hex');

/** Request to send all datapoints (ISM8i manual, chapter 8.5) */
export const GET_ALL = Buffer.from('0620F080001604000000F0D0', 'hex');

/** SetDatapointValue.Res, the start datapoint is set per acknowledgement (bytes 12-13) */
const ACKNOWLEDGE = Buffer.from('0620F080001104000000F086006E000000', 'hex');

/**
 * Splits received data into complete telegrams.
 * The frame size (bytes 4-5) tells how long a telegram is. An incomplete telegram at the end
 * is returned as rest and must be prepended to the next received chunk.
 */
export function splitTelegrams(buffer: Buffer, log: LogFunction): { telegrams: Buffer[]; rest: Buffer } {
    const telegrams: Buffer[] = [];
    while (buffer.length) {
        const start = buffer.indexOf(HEADER);
        if (start === -1) {
            // keep the last bytes, they could be the beginning of the next header
            const keep = Math.min(buffer.length, HEADER.length - 1);
            if (buffer.length > keep) {
                log(`Ignore data without header: ${buffer.subarray(0, buffer.length - keep).toString('hex')}`);
            }
            buffer = buffer.subarray(buffer.length - keep);
            break;
        }
        if (start > 0) {
            log(`Ignore data before header: ${buffer.subarray(0, start).toString('hex')}`);
            buffer = buffer.subarray(start);
        }
        if (buffer.length < 6) {
            // frame size not received yet
            break;
        }
        const frameSize = buffer.readUInt16BE(4);
        if (frameSize < 12) {
            log(`Ignore telegram with invalid frame size ${frameSize}: ${buffer.toString('hex')}`);
            buffer = buffer.subarray(HEADER.length);
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
 * Parses a SetDatapointValue.Req telegram (MainService 0xF0, SubService 0x06).
 * One telegram can contain several datapoints.
 *
 * @returns null if the telegram is not a SetDatapointValue.Req
 */
export function parseTelegram(telegram: Buffer, log: LogFunction): ParsedTelegram | null {
    if (telegram.length < 16 || telegram[10] !== 0xf0 || telegram[11] !== 0x06) {
        return null;
    }
    const startDp = telegram.readUInt16BE(12);
    const count = telegram.readUInt16BE(14);
    const datapoints: TelegramDatapoint[] = [];
    let offset = 16;
    for (let i = 0; i < count; i++) {
        if (offset + 4 > telegram.length) {
            log(`Telegram contains less datapoints than announced (${i} of ${count}): ${telegram.toString('hex')}`);
            break;
        }
        const dp = telegram.readUInt16BE(offset);
        const length = telegram[offset + 3];
        const value = telegram.subarray(offset + 4, offset + 4 + length);
        if (value.length < length) {
            log(`Value of DP ${dp} is incomplete: ${telegram.toString('hex')}`);
            break;
        }
        datapoints.push({ dp, value });
        offset += 4 + length;
    }
    return { startDp, datapoints };
}

/**
 * Creates the SetDatapointValue.Res for a SetDatapointValue.Req.
 * Every request must be acknowledged, otherwise the ISM8i repeats it 5 times.
 */
export function createAcknowledge(startDp: number): Buffer {
    // a new buffer for every acknowledgement, because socket.write() may still hold the previous one
    const ack = Buffer.from(ACKNOWLEDGE);
    ack.writeUInt16BE(startDp, 12);
    return ack;
}

/** Creates a DatapointValue.Ind telegram to write one datapoint */
export function createWriteTelegram(dp: number, value: Buffer): Buffer {
    const telegram = Buffer.alloc(20 + value.length);
    HEADER.copy(telegram, 0);
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
