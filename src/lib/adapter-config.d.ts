// Augments the globally declared ioBroker types with everything this adapter adds.
// Keep in sync with `native` in io-package.json and with admin/jsonConfig.json.
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** Port of the server, the ISM8i connects to it. Older versions stored it as string. */
            port: number | string;
            /** IP address of the server, 0.0.0.0 = all interfaces */
            bind: string;
            /** Write DPT_Switch, DPT_Bool, DPT_Enable and DPT_OpenClose as boolean */
            bool_status: boolean;
            /** Write pressures in bar instead of Pa. Older versions stored it as string. */
            bool_bar: boolean | string;
            /** Interval in seconds to request all values (GetAll), 0 = off. Older versions stored it as string. */
            polling_interval: number | string;
            /**
             * Which devices are processed: "Auto" = create the objects when the device sends values, "off" = ignore.
             * bm0_t is calculated: "Auto" if one of bm1_t...bm4_t is "Auto".
             */
            devices: Record<
                | 'hg0_t'
                | 'hg1_t'
                | 'hg2_t'
                | 'hg3_t'
                | 'hg4_t'
                | 'bm0_t'
                | 'bm1_t'
                | 'bm2_t'
                | 'bm3_t'
                | 'bm4_t'
                | 'mm1_t'
                | 'mm2_t'
                | 'mm3_t'
                | 'km1_t'
                | 'sm1_t'
                | 'cwl_t',
                'Auto' | 'off'
            > &
                Record<string, string>;
            /** Names of the channels, empty = default name. Key is the device with "_n" instead of "_t". */
            names: Record<string, string>;
        }
    }
}

export {}; // needed, so that the file is a module
