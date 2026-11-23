/** Datapoint types of the ISM8i (ISM8i manual, chapter 8.6) and the adapter-specific unknown types */
export type DatapointType =
    | 'DPT_Switch'
    | 'DPT_Bool'
    | 'DPT_Enable'
    | 'DPT_OpenClose'
    | 'DPT_Scaling'
    | 'DPT_Value_Temp'
    | 'DPT_Tempd'
    | 'DPT_Value_Pres'
    | 'DPT_Power'
    | 'DPT_Value_Volume_Flow'
    | 'DPT_TimeOfDay'
    | 'DPT_Date'
    | 'DPT_Value_1_Ucount'
    | 'DPT_Value_2_Ucount'
    | 'DPT_FlowRate_m3/h'
    | 'DPT_ActiveEnergy'
    | 'DPT_ActiveEnergy_kWh'
    | 'DPT_DHWMode'
    | 'DPT_HVACMode'
    | 'DPT_HVACContrMode'
    | 'DPT_Unknown1'
    | 'DPT_Unknown2';

/** One entry of datapoints.json */
export interface Datapoint {
    name: string;
    type: DatapointType;
    /** 'r' = read only, 'rw' = writable */
    rw: 'r' | 'rw';
    read: boolean;
    write: boolean;
    /** unit */
    einheit?: string;
    commonType: 'number' | 'string' | 'boolean';
    min?: number;
    max?: number;
}

/** Channel of a device, e.g. "hg1_t". "unknown" contains the datapoints without documentation. */
export type DeviceId =
    | 'hg0_t'
    | 'hg1_t'
    | 'hg2_t'
    | 'hg3_t'
    | 'hg4_t'
    | 'bm1_t'
    | 'bm2_t'
    | 'bm3_t'
    | 'bm4_t'
    | 'km1_t'
    | 'mm1_t'
    | 'mm2_t'
    | 'mm3_t'
    | 'sm1_t'
    | 'cwl_t'
    | 'unknown';

/** Range of datapoint IDs, both inclusive */
export interface DatapointRange {
    lsb: number;
    msb: number;
}

/** Value of a state as the adapter writes it */
export type StateValue = string | number | boolean;

/** One datapoint of a SetDatapointValue.Req telegram */
export interface TelegramDatapoint {
    dp: number;
    value: Buffer;
}

/** Content of a SetDatapointValue.Req telegram */
export interface ParsedTelegram {
    startDp: number;
    datapoints: TelegramDatapoint[];
}

export type LogFunction = (message: string) => void;
