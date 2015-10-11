//﻿'use strict';

// todo unterscheidung hg1 datenbereich 1-13 oder 176-191
// todo schreiben

var utils = require(__dirname + '/lib/utils');

var adapter = utils.adapter('wolf');
var net = require('net');

var dec = new (require('./js/decoder.js'))();


var ack_data = {
    old_devices: {},
    new_devices: [],
};

var datapoints = {
    1: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    2: {
        name: 'Betriebsart',
        type: 'DPT_HVACContrMode',
        rw: 'r',
        einheit: ''
    },
    3: {
        name: 'Modulationsgrad  Brennerleistung',
        type: 'DPT_Scaling',
        rw: 'r',
        einheit: '%'
    },
    4: {
        name: 'Kesseltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    5: {
        name: 'Sammlertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    6: {
        name: 'Rücklauftemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    7: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    8: {
        name: 'Außentemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    9: {
        name: 'Status Brenner / Flamme',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    10: {
        name: 'Status Heizkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    11: {
        name: 'Status Speicherladepumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    12: {
        name: 'Status 3-Wege-Umschaltventil',
        type: 'DPT_OpenClose',
        rw: 'r',
        einheit: ''
    },
    13: {
        name: 'Anlagendruck',
        type: 'DPT_Value_Pres',
        rw: 'r',
        einheit: 'Pa'
    },
    14: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    15: {
        name: 'Betriebsart',
        type: 'DPT_HVACContrMode',
        rw: 'r',
        einheit: ''
    },
    16: {
        name: 'Modulationsgrad / Brennerleistung',
        type: 'DPT_Scaling',
        rw: 'r',
        einheit: '%'
    },
    17: {
        name: 'Kesseltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    18: {
        name: 'Sammlertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    19: {
        name: 'Rücklauftemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    20: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    21: {
        name: 'Außentemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    22: {
        name: 'Status Brenner / Flamme',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    23: {
        name: 'Status Heizkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    24: {
        name: 'Status Speicherladepumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    25: {
        name: 'Status 3-Wege-Umschaltventil',
        type: 'DPT_OpenClose',
        rw: 'r',
        einheit: ''
    },
    26: {
        name: 'Anlagendruck',
        type: 'DPT_Value_Pres',
        rw: 'r',
        einheit: 'Pa'
    },
    27: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    28: {
        name: 'Betriebsart',
        type: 'DPT_HVACContrMode',
        rw: 'r',
        einheit: ''
    },
    29: {
        name: 'Modulationsgrad / Brennerleistung',
        type: 'DPT_Scaling',
        rw: 'r',
        einheit: '%'
    },
    30: {
        name: 'Kesseltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    31: {
        name: 'Sammlertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    32: {
        name: 'Rücklauftemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    33: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    34: {
        name: 'Außentemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    35: {
        name: 'Status Brenner / Flamme',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    36: {
        name: 'Status Heizkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    37: {
        name: 'Status Speicherladepumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    38: {
        name: 'Status 3-Wege-Umschaltventil',
        type: 'DPT_OpenClose',
        rw: 'r',
        einheit: ''
    },
    39: {
        name: 'Anlagendruck',
        type: 'DPT_Value_Pres',
        rw: 'r',
        einheit: 'Pa'
    },
    40: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    41: {
        name: 'Betriebsart',
        type: 'DPT_HVACContrMode',
        rw: 'r',
        einheit: ''
    },
    42: {
        name: 'Modulationsgrad / Brennerleistung',
        type: 'DPT_Scaling',
        rw: 'r',
        einheit: '%'
    },
    43: {
        name: 'Kesseltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    44: {
        name: 'Sammlertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    45: {
        name: 'Rücklauftemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    46: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    47: {
        name: 'Außentemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    48: {
        name: 'Status Brenner / Flamme',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    49: {
        name: 'Status Heizkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    50: {
        name: 'Status Speicherladepumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    51: {
        name: 'Status 3-Wege-Umschaltventil',
        type: 'DPT_OpenClose',
        rw: 'r',
        einheit: ''
    },
    52: {
        name: 'Anlagendruck',
        type: 'DPT_Value_Pres',
        rw: 'r',
        einheit: 'Pa'
    },
    53: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    54: {
        name: 'Außentemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    55: {
        name: 'Raumtemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    56: {
        name: 'Warmwassersolltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'rw',
        einheit: '°C'
    },
    57: {
        name: 'Programmwahl Heizkreis',
        type: 'DPT_HVACMode',
        rw: 'rw',
        einheit: ''
    },
    58: {
        name: 'Programmwahl Warmwasser',
        type: 'DPT_DHWMode',
        rw: 'rw',
        einheit: ''
    },
    59: {
        name: 'Heizkreis Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    60: {
        name: 'Heizkreis Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    61: {
        name: 'Heizkreis Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    62: {
        name: 'Warmwasser Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    63: {
        name: 'Warmwasser Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    64: {
        name: 'Warmwasser Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    65: {
        name: 'Sollwertkorrektur',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    66: {
        name: 'Sparfaktor',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    67: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    68: {
        name: 'Raumtemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    69: {
        name: 'Warmwassersolltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'rw',
        einheit: '°C'
    },
    70: {
        name: 'Programmwahl Mischer',
        type: 'DPT_HVACMode',
        rw: 'rw',
        einheit: ''
    },
    71: {
        name: 'Programmwahl Warmwasser',
        type: 'DPT_DHWMode',
        rw: 'rw',
        einheit: ''
    },
    72: {
        name: 'Mischer Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    73: {
        name: 'Mischer Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    74: {
        name: 'Mischer Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    75: {
        name: 'Warmwasser Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    76: {
        name: 'Warmwasser Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    77: {
        name: 'Warmwasser Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    78: {
        name: 'Sollwertkorrektur',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    79: {
        name: 'Sparfaktor',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    80: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    81: {
        name: 'Raumtemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    82: {
        name: 'Warmwassersolltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'rw',
        einheit: '°C'
    },
    83: {
        name: 'Programmwahl Mischer',
        type: 'DPT_HVACMode',
        rw: 'rw',
        einheit: ''
    },
    84: {
        name: 'Programmwahl Warmwasser',
        type: 'DPT_DHWMode',
        rw: 'rw',
        einheit: ''
    },
    85: {
        name: 'Mischer Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    86: {
        name: 'Mischer Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    87: {
        name: 'Mischer Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    88: {
        name: 'Warmwasser Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    89: {
        name: 'Warmwasser Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    90: {
        name: 'Warmwasser Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    91: {
        name: 'Sollwertkorrektur',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    92: {
        name: 'Sparfaktor',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    93: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    94: {
        name: 'Raumtemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    95: {
        name: 'Warmwassersolltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'rw',
        einheit: '°C'
    },
    96: {
        name: 'Programmwahl Mischer',
        type: 'DPT_HVACMode',
        rw: 'rw',
        einheit: ''
    },
    97: {
        name: 'Programmwahl Warmwasser',
        type: 'DPT_DHWMode',
        rw: 'rw',
        einheit: ''
    },
    98: {
        name: 'Mischer Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    99: {
        name: 'Mischer Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    100: {
        name: 'Mischer Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    101: {
        name: 'Warmwasser Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    102: {
        name: 'Warmwasser Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    103: {
        name: 'Warmwasser Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    104: {
        name: 'Sollwertkorrektur',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    105: {
        name: 'Sparfaktor',
        type: 'DPT_Tempd',
        rw: 'rw',
        einheit: 'K'
    },
    106: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    107: {
        name: 'Sammlertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    108: {
        name: 'Gesamtmodulationsgrad',
        type: 'DPT_Scaling',
        rw: 'r',
        einheit: '%'
    },
    109: {
        name: 'Vorlauftemperatur Mischerkreis',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    110: {
        name: 'Status Mischerkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    111: {
        name: 'Status Ausgang A1',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    112: {
        name: 'Eingang E1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    113: {
        name: 'Eingang E2',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    114: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    115: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    116: {
        name: 'Vorlauftemperatur Mischerkreis',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    117: {
        name: 'Status Mischerkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    118: {
        name: 'Status Ausgang A1',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    119: {
        name: 'Eingang E1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    120: {
        name: 'Eingang E2',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    121: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    122: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    123: {
        name: 'Vorlauftemperatur Mischerkreis',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    124: {
        name: 'Status Mischerkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    125: {
        name: 'Status Ausgang A1',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    126: {
        name: 'Eingang E1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    127: {
        name: 'Eingang E2',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    128: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    129: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    130: {
        name: 'Vorlauftemperatur Mischerkreis',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    131: {
        name: 'Status Mischerkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    132: {
        name: 'Status Ausgang A1',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    133: {
        name: 'Eingang E1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    134: {
        name: 'Eingang E2',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    135: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    136: {
        name: 'Warmwassertemperatur Solar 1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    137: {
        name: 'Temperatur Kollektor 1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    138: {
        name: 'Eingang E1',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    139: {
        name: 'Eingang E2 (Durchfluss)',
        type: 'DPT_Value_Volume_Flow',
        rw: 'r',
        einheit: 'l/h'
    },
    140: {
        name: 'Eingang E3',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    141: {
        name: 'Status Solarkreispumpe SKP1',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    142: {
        name: 'Status Ausgang A1',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    143: {
        name: 'Status Ausgang A2',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    144: {
        name: 'Status Ausgang A3',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    145: {
        name: 'Status Ausgang A4',
        type: 'DPT_Enable',
        rw: 'r',
        einheit: ''
    },
    146: {
        name: 'Durchfluss',
        type: 'DPT_Value_Volume_Flow',
        rw: 'r',
        einheit: 'l/h'
    },
    147: {
        name: 'aktuelle Leistung',
        type: 'DPT_Power',
        rw: 'r',
        einheit: 'kW'
    },
    148: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    149: {
        name: 'Programm',
        type: 'DPT_DHWMode',
        rw: 'rw',
        einheit: ''
    },
    150: {
        name: 'Zeitprogramm 1',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    151: {
        name: 'Zeitprogramm 2',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    152: {
        name: 'Zeitprogramm 3',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    153: {
        name: 'Zeitweise Intensivlüftung AN/AUS',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    154: {
        name: 'Zeitweise Intensivlüftung Startdatum',
        type: 'DPT_Date',
        rw: 'rw',
        einheit: ''
    },
    155: {
        name: 'Zeitweise Intensivlüftung Enddatum',
        type: 'DPT_Date',
        rw: 'rw',
        einheit: ''
    },
    156: {
        name: 'Zeitweise Intensivlüftung Startzeit',
        type: 'DPT_TimeOfDay',
        rw: 'rw',
        einheit: ''
    },
    157: {
        name: 'Zeitweise Intensivlüftung Endzeit',
        type: 'DPT_TimeOfDay',
        rw: 'rw',
        einheit: ''
    },
    158: {
        name: 'Zeitweiser Feuchteschutz AN/AUS',
        type: 'DPT_Switch',
        rw: 'rw',
        einheit: ''
    },
    159: {
        name: 'Zeitweiser Feuchteschutz Startdatum',
        type: 'DPT_Date',
        rw: 'rw',
        einheit: ''
    },
    160: {
        name: 'Zeitweiser Feuchteschutz Enddatum',
        type: 'DPT_Date',
        rw: 'rw',
        einheit: ''
    },
    161: {
        name: 'Zeitweiser Feuchteschutz Startzeit',
        type: 'DPT_TimeOfDay',
        rw: 'rw',
        einheit: ''
    },
    162: {
        name: 'Zeitweiser Feuchteschutz Endzeit',
        type: 'DPT_TimeOfDay',
        rw: 'rw',
        einheit: ''
    },
    163: {
        name: 'Lüftungsstufe',
        type: 'DPT_Scaling',
        rw: 'r',
        einheit: '%'
    },
    164: {
        name: 'Ablufttemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    165: {
        name: 'Frischlufttemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    166: {
        name: 'Luftdurchsatz Zuluft',
        type: 'DPT_FlowRate_m3/h',
        rw: 'r',
        einheit: 'm³/h'
    },
    167: {
        name: 'Luftdurchsatz Abluft',
        type: 'DPT_FlowRate_m3/h',
        rw: 'r',
        einheit: 'm³/h'
    },
    168: {
        name: 'Bypass Initialisierung',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    169: {
        name: 'Bypass öffnet/offen',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    170: {
        name: 'Bypass schließt/geschlossen',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    171: {
        name: 'Bypass Fehler',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    172: {
        name: 'Frost Status: Initialisierung/Warte',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    173: {
        name: 'Frost Status: Kein Frost',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    174: {
        name: 'Frost Status: Vorwärmer',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: ''
    },
    175: {
        name: 'Frost Status: Fehler/Unausgeglichen',
        type: 'DPT_Bool',
        rw: 'r',
        einheit: 'Heizgerät(1)'
    },
    176: {
        name: 'Störung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    177: {
        name: 'Betriebsart',
        type: 'DPT_HVACContrMode',
        rw: 'r',
        einheit: ''
    },
    178: {
        name: 'Heizleistung',
        type: 'DPT_Power',
        rw: 'r',
        einheit: 'kW'
    },
    179: {
        name: 'Kühlleistung',
        type: 'DPT_Power',
        rw: 'r',
        einheit: 'kW'
    },
    180: {
        name: 'Kesseltemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    181: {
        name: 'Sammlertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    182: {
        name: 'Rücklauftemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    183: {
        name: 'Warmwassertemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    184: {
        name: 'Außentemperatur',
        type: 'DPT_Value_Temp',
        rw: 'r',
        einheit: '°C'
    },
    185: {
        name: 'Status Heizkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    186: {
        name: 'Status Zubringer-/Heizkreispumpe',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    187: {
        name: 'Status 3-Wege-Umschaltventil HZ/WW',
        type: 'DPT_OpenClose',
        rw: 'r',
        einheit: ''
    },
    188: {
        name: 'Status 3-Wege-Umschaltventil HZ/K',
        type: 'DPT_OpenClose',
        rw: 'r',
        einheit: ''
    },
    189: {
        name: 'Status E-Heizung',
        type: 'DPT_Switch',
        rw: 'r',
        einheit: ''
    },
    190: {
        name: 'Anlagendruck',
        type: 'DPT_Value_Pres',
        rw: 'r',
        einheit: 'Pa'
    },
    191: {
        name: 'Leistungsaufnahme',
        type: 'DPT_Power',
        rw: 'r',
        einheit: 'kW'
    }
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
        return 'CWL'
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
    } else if (id == 'hg0') {
        return {'lsb': 176, 'msb': 191}
    } else {
        return false
    }

}

function decode(type, data) {

    if (type == 'DPT_Switch') {
        var val = data.readInt8()
        if (val == 0) {
            return 'Off'
        } else {
            return 'On'
        }
    } else if (type == 'DPT_Bool') {
        var val = data.readInt8()
        if (val == 0) {
            return 'false'
        } else {
            return 'true'
        }
    } else if (type == 'DPT_Enable') {
        var val = data.readInt8()
        if (val == 0) {
            return 'Disable'
        } else {
            return 'Enable'
        }
    } else if (type == 'DPT_OpenClose') {
        var val = data.readInt8()
        if (val == 0) {
            return 'Open'
        } else {
            return 'On'
        }
    } else if (type == 'DPT_Scaling') {
        return dec.decodeDPT5(data)
    } else if (type == 'DPT_Value_Temp' || type == 'DPT_Value_Tempd' || type == 'DPT_Value_Pres' || type == 'DPT_Power' || type == 'DPT_Value_Volume_Flow') {
        return Math.round(dec.decodeDPT9(data) * 100) / 100
    } else if (type == 'DPT_TimeOfDay') {
        return dec.decodeDPT10(data)
    } else if (type == 'DPT_Date') {
        return dec.decodeDPT11(data)
    } else if (type == 'DPT_FlowRate_m3/h') {
        return dec.decodeDPT13(data)
    } else if (type == 'DPT_HVAVMode') {
        return dec.decodeDPT20(data)
    } else {
        return 'undefind datapoint'
    }
}

function main() {

    adapter.getForeignObjects(adapter.namespace + '.*', function (err, list) {

//console.log(list)
        for (var idd in list) {

            ack_data[idd.split('.').pop()] = {id: idd}
            ack_data.old_devices[idd.split('.')[2]] = idd.split('.')[2];
        }


console.log(adapter.namespace)
        var devices = adapter.config.devices;
        var names = adapter.config.names;

        var buff_req = new Buffer(17);
        buff_req[0] = 0x06;
        buff_req[1] = 0x20;
        buff_req[2] = 0xF0;
        buff_req[3] = 0x80;
        buff_req[4] = 0x00;
        buff_req[5] = 0x15;
        buff_req[6] = 0x04;
        buff_req[7] = 0x00;
        buff_req[8] = 0x00;
        buff_req[9] = 0x00;
        buff_req[10] = 0xF0;
        buff_req[11] = 0x86;
        buff_req[12] = 0x00;
        buff_req[13] = 0x6E;
        buff_req[14] = 0x00;
        buff_req[15] = 0x00;
        buff_req[16] = 0x00;

        var buff_getall = new Buffer(12);
        buff_getall[0] = 0x06;
        buff_getall[1] = 0x20;
        buff_getall[2] = 0xF0;
        buff_getall[3] = 0x80;
        buff_getall[4] = 0x00;
        buff_getall[5] = 0x16;
        buff_getall[6] = 0x04;
        buff_getall[7] = 0x00;
        buff_getall[8] = 0x00;
        buff_getall[9] = 0x00;
        buff_getall[10] = 0xF0;
        buff_getall[11] = 0xD0;


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
                            group_name = 'Heizgeräte'
                        } else if (dev.match(/bm/)) {
                            group_name = 'Bediengeräte'
                        } else if (dev.match(/mm/)) {
                            group_name = 'Mischermodule'
                        } else if (dev.match(/km/)) {
                            group_name = 'Kaskadenmodul'
                        } else if (dev.match(/sm/)) {
                            group_name = 'Solarmodul'
                        }

                    }

                    adapter.setObject(dev, {
                        type: 'channel',
                        common: {
                            name: names[dev + '_n'] || group_name + ' ' + dev.slice(-1),
                            type: 'channel',
                        },
                        native: {}
                    });


                    for (range.lsb; range.lsb <= range.msb; range.lsb++) {

                        if (!ack_data[range.lsb]) {
console.log(range.lsb)
                            var data = datapoints[range.lsb];
                            ack_data[range.lsb] = {id: adapter.namespace+"."+ dev + '.' + range.lsb}
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
                                    rw: data.rw,
                                }
                            });
                        }
                    }
                }
            }
        }


        for (var dev in ack_data.old_devices){
            if(ack_data.new_devices.indexOf(dev) == -1){
                //console.log('delete ' + dev)
                adapter.deleteChannel(dev, function(){
                });
                var range = get_device_rage();
                for (range.lsb; range.lsb <= range.msb; range.lsb++) {
                   delete ack_data[range.lsb]
                }
            }
        }


        net.createServer(function (sock) {

            sock.write(buff_getall);

            //sock.on('connect', function (e) {
            //    console.log(e)
            //});

            sock.on('data', function (_data) {

                buff_req[12] = _data[12];
                buff_req[13] = _data[13];
                sock.write(buff_req)

                var dp = _data.readUInt16BE(12);
                var device = get_device(dp);


                if (ack_data[device] == undefined) {

                }

                if (datapoints[dp] && ack_data[dp] ) {
                    var val = decode(datapoints[dp].type, _data.slice(20))
                    adapter.setState(device + '.' + dp, val, true);
                    ack_data[dp]["value"] = val;
                    console.log('-----------------------------------------');
                    console.log('Device: ' + device);
                    console.log('Datapoint: ' + dp);
                    console.log('Datapoint_name: ' + datapoints[dp].name);
                    console.log('Datapoint_type: ' + datapoints[dp].type);
                    console.log('value: ' + val);
                    console.log('oid: ' + device + '.' + dp);
                }
            })
        }).listen(adapter.config.ism8_port, adapter.config.host_ip);

        adapter.subscribeStates('*');
        adapter.on('stateChange', function (id, state) {
            if (state && !state.ack && id) {
                var dp = id.split('.').pop();
                if(datapoints[dp].rw == "r"){
                    adapter.setState(id, ack_data[dp].value, true);
                    adapter.log.error("oid: "+id + " is only readable")
                }else{
                    adapter.setState(id, ack_data[dp].value, true); // todo hier an ism8 senden
                }

            }

        });
    });
}


adapter.on('ready', function () {
    main();
});