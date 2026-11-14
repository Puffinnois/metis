import type { Box, TeamSeason } from '../../src/main/stats/models/box'

/**
 * The 2016-17 regular season as Metis's box scores hold it (`player_season`, `team_season`), for the
 * composites' worked values (Plan T1005). Team turnovers are added to each team's and opponent's
 * `tov`, as the loader does: the team turnovers from the NBA's play by play. Minutes to four places.
 */

export interface NamedLine {
  name: string
  position: string
  box: Box
}

/** Every Cleveland player of 2016-17, most minutes first. */
export const CLE_2017: NamedLine[] = [
  {
    name: 'LeBron James',
    position: 'F',
    box: {
      mp: 2794.5833,
      fgm: 736,
      fga: 1344,
      fg3m: 124,
      fg3a: 342,
      ftm: 358,
      fta: 531,
      oreb: 97,
      dreb: 542,
      ast: 646,
      stl: 92,
      blk: 44,
      tov: 303,
      pf: 134,
      pts: 1954
    }
  },
  {
    name: 'Kyrie Irving',
    position: 'G',
    box: {
      mp: 2524.6333,
      fgm: 671,
      fga: 1420,
      fg3m: 177,
      fg3a: 441,
      ftm: 297,
      fta: 328,
      oreb: 52,
      dreb: 178,
      ast: 418,
      stl: 83,
      blk: 24,
      tov: 180,
      pf: 157,
      pts: 1816
    }
  },
  {
    name: 'Tristan Thompson',
    position: 'C',
    box: {
      mp: 2336.3667,
      fgm: 262,
      fga: 437,
      fg3m: 0,
      fg3a: 3,
      ftm: 106,
      fta: 213,
      oreb: 286,
      dreb: 429,
      ast: 77,
      stl: 39,
      blk: 84,
      tov: 64,
      pf: 176,
      pts: 630
    }
  },
  {
    name: 'Iman Shumpert',
    position: 'G',
    box: {
      mp: 1937.2667,
      fgm: 201,
      fga: 489,
      fg3m: 94,
      fg3a: 261,
      ftm: 71,
      fta: 90,
      oreb: 39,
      dreb: 179,
      ast: 109,
      stl: 62,
      blk: 27,
      tov: 78,
      pf: 150,
      pts: 567
    }
  },
  {
    name: 'Kevin Love',
    position: 'F',
    box: {
      mp: 1884.6333,
      fgm: 370,
      fga: 867,
      fg3m: 145,
      fg3a: 389,
      ftm: 257,
      fta: 295,
      oreb: 148,
      dreb: 518,
      ast: 116,
      stl: 53,
      blk: 21,
      tov: 122,
      pf: 125,
      pts: 1142
    }
  },
  {
    name: 'Richard Jefferson',
    position: 'F',
    box: {
      mp: 1613.65,
      fgm: 153,
      fga: 343,
      fg3m: 62,
      fg3a: 186,
      ftm: 80,
      fta: 108,
      oreb: 28,
      dreb: 175,
      ast: 78,
      stl: 26,
      blk: 10,
      tov: 52,
      pf: 153,
      pts: 448
    }
  },
  {
    name: 'Channing Frye',
    position: 'F',
    box: {
      mp: 1397.8667,
      fgm: 238,
      fga: 520,
      fg3m: 137,
      fg3a: 335,
      ftm: 63,
      fta: 74,
      oreb: 37,
      dreb: 253,
      ast: 45,
      stl: 33,
      blk: 37,
      tov: 53,
      pf: 138,
      pts: 676
    }
  },
  {
    name: 'JR Smith',
    position: 'G',
    box: {
      mp: 1187.2333,
      fgm: 123,
      fga: 356,
      fg3m: 95,
      fg3a: 271,
      ftm: 10,
      fta: 15,
      oreb: 17,
      dreb: 96,
      ast: 62,
      stl: 40,
      blk: 11,
      tov: 26,
      pf: 77,
      pts: 351
    }
  },
  {
    name: 'Kyle Korver',
    position: 'G',
    box: {
      mp: 858.6667,
      fgm: 131,
      fga: 269,
      fg3m: 97,
      fg3a: 200,
      ftm: 14,
      fta: 15,
      oreb: 7,
      dreb: 90,
      ast: 35,
      stl: 11,
      blk: 8,
      tov: 29,
      pf: 60,
      pts: 373
    }
  },
  {
    name: 'DeAndre Liggins',
    position: 'G',
    box: {
      mp: 751.9833,
      fgm: 52,
      fga: 136,
      fg3m: 17,
      fg3a: 45,
      ftm: 23,
      fta: 37,
      oreb: 17,
      dreb: 84,
      ast: 54,
      stl: 45,
      blk: 14,
      tov: 42,
      pf: 78,
      pts: 144
    }
  },
  {
    name: 'Deron Williams',
    position: 'G',
    box: {
      mp: 486.3667,
      fgm: 68,
      fga: 147,
      fg3m: 22,
      fg3a: 53,
      ftm: 21,
      fta: 25,
      oreb: 1,
      dreb: 44,
      ast: 86,
      stl: 6,
      blk: 6,
      tov: 40,
      pf: 42,
      pts: 179
    }
  },
  {
    name: 'Derrick Williams',
    position: 'F',
    box: {
      mp: 427.25,
      fgm: 54,
      fga: 107,
      fg3m: 21,
      fg3a: 52,
      ftm: 27,
      fta: 39,
      oreb: 3,
      dreb: 54,
      ast: 14,
      stl: 5,
      blk: 2,
      tov: 14,
      pf: 27,
      pts: 156
    }
  },
  {
    name: 'Kay Felder',
    position: 'G',
    box: {
      mp: 385.7667,
      fgm: 62,
      fga: 158,
      fg3m: 7,
      fg3a: 22,
      ftm: 35,
      fta: 49,
      oreb: 3,
      dreb: 38,
      ast: 58,
      stl: 18,
      blk: 7,
      tov: 30,
      pf: 38,
      pts: 166
    }
  },
  {
    name: 'Jordan McRae',
    position: 'G',
    box: {
      mp: 383.5167,
      fgm: 58,
      fga: 150,
      fg3m: 18,
      fg3a: 51,
      ftm: 27,
      fta: 34,
      oreb: 6,
      dreb: 35,
      ast: 19,
      stl: 8,
      blk: 6,
      tov: 14,
      pf: 31,
      pts: 161
    }
  },
  {
    name: 'James Jones',
    position: 'G',
    box: {
      mp: 380.6333,
      fgm: 44,
      fga: 92,
      fg3m: 31,
      fg3a: 66,
      ftm: 13,
      fta: 20,
      oreb: 3,
      dreb: 34,
      ast: 14,
      stl: 6,
      blk: 10,
      tov: 10,
      pf: 37,
      pts: 132
    }
  },
  {
    name: 'Mike Dunleavy',
    position: 'G',
    box: {
      mp: 366.3833,
      fgm: 36,
      fga: 90,
      fg3m: 20,
      fg3a: 57,
      ftm: 14,
      fta: 19,
      oreb: 5,
      dreb: 42,
      ast: 20,
      stl: 6,
      blk: 2,
      tov: 14,
      pf: 32,
      pts: 106
    }
  },
  {
    name: 'Chris Andersen',
    position: 'F',
    box: {
      mp: 113.8,
      fgm: 9,
      fga: 22,
      fg3m: 0,
      fg3a: 3,
      ftm: 10,
      fta: 14,
      oreb: 9,
      dreb: 22,
      ast: 5,
      stl: 5,
      blk: 7,
      tov: 5,
      pf: 20,
      pts: 28
    }
  },
  {
    name: 'Edy Tavares',
    position: 'C',
    box: {
      mp: 24,
      fgm: 3,
      fga: 4,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 1,
      oreb: 4,
      dreb: 6,
      ast: 1,
      stl: 0,
      blk: 6,
      tov: 2,
      pf: 3,
      pts: 6
    }
  },
  {
    name: 'Larry Sanders',
    position: 'F',
    box: {
      mp: 12.7,
      fgm: 1,
      fga: 4,
      fg3m: 0,
      fg3a: 0,
      ftm: 2,
      fta: 2,
      oreb: 3,
      dreb: 1,
      ast: 0,
      stl: 1,
      blk: 1,
      tov: 2,
      pf: 5,
      pts: 4
    }
  },
  {
    name: 'Dahntay Jones',
    position: 'G',
    box: {
      mp: 12,
      fgm: 3,
      fga: 8,
      fg3m: 0,
      fg3a: 2,
      ftm: 3,
      fta: 4,
      oreb: 1,
      dreb: 1,
      ast: 1,
      stl: 0,
      blk: 0,
      tov: 1,
      pf: 1,
      pts: 9
    }
  },
  {
    name: 'Andrew Bogut',
    position: 'C',
    box: {
      mp: 0.9667,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 2,
      pts: 0
    }
  }
]

export const CLE_ID = 1610612739

/** Every team's 2016-17 regular season, keyed by team id; `games` are its box-score games. */
export const TEAMS_2017: [number, string, TeamSeason][] = [
  [
    1610612737,
    'ATL',
    {
      games: 82,
      team: {
        mp: 19880,
        fgm: 3123,
        fga: 6918,
        fg3m: 729,
        fg3a: 2137,
        ftm: 1484,
        fta: 2039,
        oreb: 842,
        dreb: 2793,
        ast: 1938,
        stl: 672,
        blk: 397,
        tov: 1294,
        pf: 1491,
        pts: 8459
      },
      opp: {
        mp: 19880,
        fgm: 3178,
        fga: 7155,
        fg3m: 893,
        fg3a: 2502,
        ftm: 1280,
        fta: 1658,
        oreb: 876,
        dreb: 2722,
        ast: 1919,
        stl: 738,
        blk: 424,
        tov: 1262,
        pf: 1768,
        pts: 8529
      }
    }
  ],
  [
    1610612738,
    'BOS',
    {
      games: 82,
      team: {
        mp: 19755,
        fgm: 3168,
        fga: 6977,
        fg3m: 985,
        fg3a: 2741,
        ftm: 1536,
        fta: 1903,
        oreb: 743,
        dreb: 2698,
        ast: 2069,
        stl: 617,
        blk: 340,
        tov: 1088,
        pf: 1686,
        pts: 8857
      },
      opp: {
        mp: 19755,
        fgm: 3168,
        fga: 7035,
        fg3m: 735,
        fg3a: 2213,
        ftm: 1570,
        fta: 2042,
        oreb: 883,
        dreb: 2769,
        ast: 1851,
        stl: 623,
        blk: 425,
        tov: 1141,
        pf: 1664,
        pts: 8641
      }
    }
  ],
  [
    1610612739,
    'CLE',
    {
      games: 82,
      team: {
        mp: 19880,
        fgm: 3275,
        fga: 6963,
        fg3m: 1067,
        fg3a: 2779,
        ftm: 1431,
        fta: 1913,
        oreb: 766,
        dreb: 2821,
        ast: 1858,
        stl: 539,
        blk: 327,
        tov: 1121,
        pf: 1486,
        pts: 9048
      },
      opp: {
        mp: 19880,
        fgm: 3333,
        fga: 7284,
        fg3m: 850,
        fg3a: 2353,
        ftm: 1271,
        fta: 1644,
        oreb: 902,
        dreb: 2724,
        ast: 2024,
        stl: 598,
        blk: 349,
        tov: 1033,
        pf: 1690,
        pts: 8787
      }
    }
  ],
  [
    1610612740,
    'NOP',
    {
      games: 82,
      team: {
        mp: 19905,
        fgm: 3210,
        fga: 7130,
        fg3m: 768,
        fg3a: 2196,
        ftm: 1368,
        fta: 1825,
        oreb: 703,
        dreb: 2879,
        ast: 1869,
        stl: 638,
        blk: 453,
        tov: 1054,
        pf: 1490,
        pts: 8556
      },
      opp: {
        mp: 19905,
        fgm: 3286,
        fga: 7299,
        fg3m: 863,
        fg3a: 2445,
        ftm: 1293,
        fta: 1697,
        oreb: 872,
        dreb: 3091,
        ast: 1921,
        stl: 603,
        blk: 348,
        tov: 1144,
        pf: 1581,
        pts: 8728
      }
    }
  ],
  [
    1610612741,
    'CHI',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 3169,
        fga: 7141,
        fg3m: 623,
        fg3a: 1831,
        ftm: 1474,
        fta: 1848,
        oreb: 999,
        dreb: 2797,
        ast: 1851,
        stl: 643,
        blk: 393,
        tov: 1112,
        pf: 1455,
        pts: 8435
      },
      opp: {
        mp: 19780,
        fgm: 3236,
        fga: 7099,
        fg3m: 731,
        fg3a: 2121,
        ftm: 1197,
        fta: 1555,
        oreb: 843,
        dreb: 2698,
        ast: 1939,
        stl: 602,
        blk: 378,
        tov: 1100,
        pf: 1541,
        pts: 8400
      }
    }
  ],
  [
    1610612742,
    'DAL',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 2968,
        fga: 6750,
        fg3m: 878,
        fg3a: 2473,
        ftm: 1215,
        fta: 1516,
        oreb: 647,
        dreb: 2516,
        ast: 1705,
        stl: 614,
        blk: 307,
        tov: 972,
        pf: 1567,
        pts: 8029
      },
      opp: {
        mp: 19780,
        fgm: 3035,
        fga: 6477,
        fg3m: 788,
        fg3a: 2074,
        ftm: 1411,
        fta: 1827,
        oreb: 727,
        dreb: 2923,
        ast: 1743,
        stl: 535,
        blk: 280,
        tov: 1225,
        pf: 1591,
        pts: 8269
      }
    }
  ],
  [
    1610612743,
    'DEN',
    {
      games: 82,
      team: {
        mp: 19755,
        fgm: 3377,
        fga: 7194,
        fg3m: 870,
        fg3a: 2365,
        ftm: 1537,
        fta: 1986,
        oreb: 966,
        dreb: 2837,
        ast: 2077,
        stl: 568,
        blk: 323,
        tov: 1226,
        pf: 1567,
        pts: 9161
      },
      opp: {
        mp: 19755,
        fgm: 3454,
        fga: 7248,
        fg3m: 808,
        fg3a: 2153,
        ftm: 1403,
        fta: 1794,
        oreb: 770,
        dreb: 2576,
        ast: 1972,
        stl: 681,
        blk: 404,
        tov: 982,
        pf: 1653,
        pts: 9119
      }
    }
  ],
  [
    1610612744,
    'GSW',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 3532,
        fga: 7140,
        fg3m: 982,
        fg3a: 2562,
        ftm: 1457,
        fta: 1850,
        oreb: 770,
        dreb: 2873,
        ast: 2491,
        stl: 785,
        blk: 555,
        tov: 1211,
        pf: 1585,
        pts: 9503
      },
      opp: {
        mp: 19780,
        fgm: 3181,
        fga: 7311,
        fg3m: 737,
        fg3a: 2277,
        ftm: 1450,
        fta: 1905,
        oreb: 963,
        dreb: 2604,
        ast: 1862,
        stl: 705,
        blk: 313,
        tov: 1272,
        pf: 1588,
        pts: 8549
      }
    }
  ],
  [
    1610612745,
    'HOU',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 3305,
        fga: 7152,
        fg3m: 1181,
        fg3a: 3306,
        ftm: 1667,
        fta: 2177,
        oreb: 892,
        dreb: 2746,
        ast: 2070,
        stl: 670,
        blk: 352,
        tov: 1240,
        pf: 1634,
        pts: 9458
      },
      opp: {
        mp: 19780,
        fgm: 3375,
        fga: 7286,
        fg3m: 820,
        fg3a: 2389,
        ftm: 1415,
        fta: 1819,
        oreb: 878,
        dreb: 2735,
        ast: 1979,
        stl: 697,
        blk: 409,
        tov: 1235,
        pf: 1674,
        pts: 8985
      }
    }
  ],
  [
    1610612746,
    'LAC',
    {
      games: 82,
      team: {
        mp: 19755,
        fgm: 3242,
        fga: 6820,
        fg3m: 841,
        fg3a: 2245,
        ftm: 1586,
        fta: 2128,
        oreb: 738,
        dreb: 2790,
        ast: 1848,
        stl: 612,
        blk: 347,
        tov: 1062,
        pf: 1626,
        pts: 8911
      },
      opp: {
        mp: 19755,
        fgm: 3163,
        fga: 6999,
        fg3m: 753,
        fg3a: 2154,
        ftm: 1480,
        fta: 1917,
        oreb: 837,
        dreb: 2700,
        ast: 1891,
        stl: 577,
        blk: 258,
        tov: 1084,
        pf: 1835,
        pts: 8559
      }
    }
  ],
  [
    1610612747,
    'LAL',
    {
      games: 82,
      team: {
        mp: 19705,
        fgm: 3224,
        fga: 7164,
        fg3m: 730,
        fg3a: 2110,
        ftm: 1397,
        fta: 1853,
        oreb: 933,
        dreb: 2636,
        ast: 1716,
        stl: 674,
        blk: 320,
        tov: 1243,
        pf: 1698,
        pts: 8575
      },
      opp: {
        mp: 19705,
        fgm: 3405,
        fga: 7053,
        fg3m: 830,
        fg3a: 2245,
        ftm: 1499,
        fta: 1966,
        oreb: 843,
        dreb: 2801,
        ast: 2110,
        stl: 698,
        blk: 440,
        tov: 1188,
        pf: 1520,
        pts: 9139
      }
    }
  ],
  [
    1610612748,
    'MIA',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 3202,
        fga: 7037,
        fg3m: 808,
        fg3a: 2213,
        ftm: 1248,
        fta: 1768,
        oreb: 872,
        dreb: 2705,
        ast: 1742,
        stl: 588,
        blk: 469,
        tov: 1102,
        pf: 1680,
        pts: 8460
      },
      opp: {
        mp: 19780,
        fgm: 3108,
        fga: 6904,
        fg3m: 639,
        fg3a: 1864,
        ftm: 1518,
        fta: 1940,
        oreb: 837,
        dreb: 2737,
        ast: 1611,
        stl: 556,
        blk: 398,
        tov: 1121,
        pf: 1530,
        pts: 8373
      }
    }
  ],
  [
    1610612749,
    'MIL',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 3182,
        fga: 6715,
        fg3m: 720,
        fg3a: 1946,
        ftm: 1413,
        fta: 1839,
        oreb: 723,
        dreb: 2589,
        ast: 1984,
        stl: 666,
        blk: 436,
        tov: 1145,
        pf: 1660,
        pts: 8497
      },
      opp: {
        mp: 19780,
        fgm: 3116,
        fga: 6801,
        fg3m: 816,
        fg3a: 2311,
        ftm: 1464,
        fta: 1900,
        oreb: 844,
        dreb: 2636,
        ast: 1974,
        stl: 609,
        blk: 375,
        tov: 1205,
        pf: 1579,
        pts: 8512
      }
    }
  ],
  [
    1610612750,
    'MIN',
    {
      games: 82,
      team: {
        mp: 19805,
        fgm: 3235,
        fga: 6922,
        fg3m: 601,
        fg3a: 1723,
        ftm: 1586,
        fta: 1986,
        oreb: 938,
        dreb: 2540,
        ast: 1940,
        stl: 654,
        blk: 370,
        tov: 1150,
        pf: 1646,
        pts: 8657
      },
      opp: {
        mp: 19805,
        fgm: 3246,
        fga: 6829,
        fg3m: 811,
        fg3a: 2213,
        ftm: 1445,
        fta: 1881,
        oreb: 806,
        dreb: 2508,
        ast: 1896,
        stl: 629,
        blk: 413,
        tov: 1169,
        pf: 1681,
        pts: 8748
      }
    }
  ],
  [
    1610612751,
    'BKN',
    {
      games: 82,
      team: {
        mp: 19755,
        fgm: 3102,
        fga: 6987,
        fg3m: 877,
        fg3a: 2591,
        ftm: 1592,
        fta: 2020,
        oreb: 721,
        dreb: 2879,
        ast: 1756,
        stl: 593,
        blk: 387,
        tov: 1356,
        pf: 1726,
        pts: 8673
      },
      opp: {
        mp: 19755,
        fgm: 3414,
        fga: 7449,
        fg3m: 816,
        fg3a: 2232,
        ftm: 1581,
        fta: 2049,
        oreb: 902,
        dreb: 2965,
        ast: 1888,
        stl: 780,
        blk: 457,
        tov: 1092,
        pf: 1671,
        pts: 9225
      }
    }
  ],
  [
    1610612752,
    'NYK',
    {
      games: 82,
      team: {
        mp: 19855,
        fgm: 3244,
        fga: 7256,
        fg3m: 704,
        fg3a: 2022,
        ftm: 1364,
        fta: 1731,
        oreb: 983,
        dreb: 2723,
        ast: 1786,
        stl: 581,
        blk: 455,
        tov: 1139,
        pf: 1668,
        pts: 8556
      },
      opp: {
        mp: 19855,
        fgm: 3259,
        fga: 7163,
        fg3m: 806,
        fg3a: 2313,
        ftm: 1533,
        fta: 1988,
        oreb: 953,
        dreb: 2715,
        ast: 1786,
        stl: 615,
        blk: 377,
        tov: 1060,
        pf: 1516,
        pts: 8857
      }
    }
  ],
  [
    1610612753,
    'ORL',
    {
      games: 82,
      team: {
        mp: 19805,
        fgm: 3139,
        fga: 7133,
        fg3m: 701,
        fg3a: 2139,
        ftm: 1309,
        fta: 1753,
        oreb: 807,
        dreb: 2734,
        ast: 1820,
        stl: 580,
        blk: 396,
        tov: 1091,
        pf: 1584,
        pts: 8288
      },
      opp: {
        mp: 19805,
        fgm: 3304,
        fga: 7081,
        fg3m: 794,
        fg3a: 2161,
        ftm: 1425,
        fta: 1860,
        oreb: 799,
        dreb: 2934,
        ast: 1936,
        stl: 622,
        blk: 419,
        tov: 1069,
        pf: 1532,
        pts: 8827
      }
    }
  ],
  [
    1610612754,
    'IND',
    {
      games: 82,
      team: {
        mp: 19855,
        fgm: 3221,
        fga: 6931,
        fg3m: 709,
        fg3a: 1885,
        ftm: 1467,
        fta: 1811,
        oreb: 742,
        dreb: 2702,
        ast: 1844,
        stl: 669,
        blk: 409,
        tov: 1130,
        pf: 1597,
        pts: 8618
      },
      opp: {
        mp: 19855,
        fgm: 3115,
        fga: 6909,
        fg3m: 849,
        fg3a: 2389,
        ftm: 1557,
        fta: 1974,
        oreb: 879,
        dreb: 2751,
        ast: 1832,
        stl: 661,
        blk: 407,
        tov: 1225,
        pf: 1599,
        pts: 8636
      }
    }
  ],
  [
    1610612755,
    'PHI',
    {
      games: 82,
      team: {
        mp: 19830,
        fgm: 3088,
        fga: 6992,
        fg3m: 831,
        fg3a: 2443,
        ftm: 1393,
        fta: 1806,
        oreb: 807,
        dreb: 2706,
        ast: 1949,
        stl: 692,
        blk: 420,
        tov: 1366,
        pf: 1793,
        pts: 8400
      },
      opp: {
        mp: 19830,
        fgm: 3244,
        fga: 7043,
        fg3m: 729,
        fg3a: 2044,
        ftm: 1650,
        fta: 2135,
        oreb: 886,
        dreb: 2802,
        ast: 1859,
        stl: 704,
        blk: 446,
        tov: 1241,
        pf: 1610,
        pts: 8867
      }
    }
  ],
  [
    1610612756,
    'PHX',
    {
      games: 82,
      team: {
        mp: 19830,
        fgm: 3270,
        fga: 7260,
        fg3m: 615,
        fg3a: 1854,
        ftm: 1676,
        fta: 2159,
        oreb: 976,
        dreb: 2712,
        ast: 1604,
        stl: 673,
        blk: 399,
        tov: 1265,
        pf: 2030,
        pts: 8831
      },
      opp: {
        mp: 19830,
        fgm: 3300,
        fga: 7070,
        fg3m: 825,
        fg3a: 2159,
        ftm: 1868,
        fta: 2387,
        oreb: 840,
        dreb: 2772,
        ast: 1818,
        stl: 663,
        blk: 435,
        tov: 1222,
        pf: 1822,
        pts: 9293
      }
    }
  ],
  [
    1610612757,
    'POR',
    {
      games: 82,
      team: {
        mp: 19930,
        fgm: 3243,
        fga: 7059,
        fg3m: 852,
        fg3a: 2272,
        ftm: 1513,
        fta: 1940,
        oreb: 830,
        dreb: 2750,
        ast: 1733,
        stl: 574,
        blk: 408,
        tov: 1126,
        pf: 1736,
        pts: 8851
      },
      opp: {
        mp: 19930,
        fgm: 3213,
        fga: 7069,
        fg3m: 762,
        fg3a: 2058,
        ftm: 1706,
        fta: 2173,
        oreb: 830,
        dreb: 2778,
        ast: 1688,
        stl: 633,
        blk: 431,
        tov: 1052,
        pf: 1624,
        pts: 8894
      }
    }
  ],
  [
    1610612758,
    'SAC',
    {
      games: 82,
      team: {
        mp: 19880,
        fgm: 3105,
        fga: 6734,
        fg3m: 737,
        fg3a: 1960,
        ftm: 1483,
        fta: 1913,
        oreb: 715,
        dreb: 2652,
        ast: 1844,
        stl: 627,
        blk: 324,
        tov: 1201,
        pf: 1667,
        pts: 8430
      },
      opp: {
        mp: 19880,
        fgm: 3153,
        fga: 6824,
        fg3m: 896,
        fg3a: 2462,
        ftm: 1546,
        fta: 1988,
        oreb: 826,
        dreb: 2689,
        ast: 1941,
        stl: 694,
        blk: 420,
        tov: 1145,
        pf: 1646,
        pts: 8748
      }
    }
  ],
  [
    1610612759,
    'SAS',
    {
      games: 82,
      team: {
        mp: 19805,
        fgm: 3222,
        fga: 6864,
        fg3m: 753,
        fg3a: 1927,
        ftm: 1440,
        fta: 1806,
        oreb: 821,
        dreb: 2777,
        ast: 1954,
        stl: 655,
        blk: 484,
        tov: 1101,
        pf: 1498,
        pts: 8637
      },
      opp: {
        mp: 19805,
        fgm: 3032,
        fga: 6839,
        fg3m: 668,
        fg3a: 1942,
        ftm: 1315,
        fta: 1705,
        oreb: 800,
        dreb: 2600,
        ast: 1757,
        stl: 614,
        blk: 333,
        tov: 1184,
        pf: 1623,
        pts: 8047
      }
    }
  ],
  [
    1610612760,
    'OKC',
    {
      games: 82,
      team: {
        mp: 19805,
        fgm: 3237,
        fga: 7169,
        fg3m: 692,
        fg3a: 2116,
        ftm: 1575,
        fta: 2113,
        oreb: 1002,
        dreb: 2821,
        ast: 1721,
        stl: 648,
        blk: 408,
        tov: 1230,
        pf: 1715,
        pts: 8741
      },
      opp: {
        mp: 19805,
        fgm: 3215,
        fga: 6998,
        fg3m: 724,
        fg3a: 2036,
        ftm: 1525,
        fta: 1996,
        oreb: 750,
        dreb: 2583,
        ast: 1758,
        stl: 698,
        blk: 450,
        tov: 1129,
        pf: 1697,
        pts: 8679
      }
    }
  ],
  [
    1610612761,
    'TOR',
    {
      games: 82,
      team: {
        mp: 19780,
        fgm: 3211,
        fga: 6918,
        fg3m: 725,
        fg3a: 1996,
        ftm: 1615,
        fta: 2028,
        oreb: 871,
        dreb: 2676,
        ast: 1517,
        stl: 677,
        blk: 400,
        tov: 1041,
        pf: 1708,
        pts: 8762
      },
      opp: {
        mp: 19780,
        fgm: 3052,
        fga: 6801,
        fg3m: 794,
        fg3a: 2240,
        ftm: 1519,
        fta: 1948,
        oreb: 831,
        dreb: 2619,
        ast: 1786,
        stl: 547,
        blk: 392,
        tov: 1200,
        pf: 1666,
        pts: 8417
      }
    }
  ],
  [
    1610612762,
    'UTA',
    {
      games: 82,
      team: {
        mp: 19755,
        fgm: 3033,
        fga: 6515,
        fg3m: 791,
        fg3a: 2128,
        ftm: 1401,
        fta: 1875,
        oreb: 771,
        dreb: 2774,
        ast: 1651,
        stl: 550,
        blk: 410,
        tov: 1118,
        pf: 1545,
        pts: 8258
      },
      opp: {
        mp: 19755,
        fgm: 2978,
        fga: 6723,
        fg3m: 671,
        fg3a: 1874,
        ftm: 1308,
        fta: 1701,
        oreb: 742,
        dreb: 2554,
        ast: 1463,
        stl: 598,
        blk: 312,
        tov: 995,
        pf: 1655,
        pts: 7935
      }
    }
  ],
  [
    1610612763,
    'MEM',
    {
      games: 82,
      team: {
        mp: 19905,
        fgm: 2984,
        fga: 6854,
        fg3m: 767,
        fg3a: 2169,
        ftm: 1504,
        fta: 1918,
        oreb: 886,
        dreb: 2621,
        ast: 1744,
        stl: 653,
        blk: 344,
        tov: 1059,
        pf: 1840,
        pts: 8239
      },
      opp: {
        mp: 19905,
        fgm: 2864,
        fga: 6465,
        fg3m: 813,
        fg3a: 2299,
        ftm: 1658,
        fta: 2202,
        oreb: 761,
        dreb: 2692,
        ast: 1645,
        stl: 574,
        blk: 410,
        tov: 1171,
        pf: 1708,
        pts: 8199
      }
    }
  ],
  [
    1610612764,
    'WAS',
    {
      games: 82,
      team: {
        mp: 19855,
        fgm: 3388,
        fga: 7137,
        fg3m: 756,
        fg3a: 2030,
        ftm: 1421,
        fta: 1812,
        oreb: 843,
        dreb: 2671,
        ast: 1956,
        stl: 693,
        blk: 336,
        tov: 1162,
        pf: 1745,
        pts: 8953
      },
      opp: {
        mp: 19855,
        fgm: 3253,
        fga: 6978,
        fg3m: 810,
        fg3a: 2224,
        ftm: 1489,
        fta: 1982,
        oreb: 868,
        dreb: 2661,
        ast: 1870,
        stl: 606,
        blk: 377,
        tov: 1257,
        pf: 1621,
        pts: 8805
      }
    }
  ],
  [
    1610612765,
    'DET',
    {
      games: 82,
      team: {
        mp: 19805,
        fgm: 3269,
        fga: 7282,
        fg3m: 631,
        fg3a: 1915,
        ftm: 1140,
        fta: 1586,
        oreb: 908,
        dreb: 2838,
        ast: 1732,
        stl: 574,
        blk: 310,
        tov: 973,
        pf: 1467,
        pts: 8309
      },
      opp: {
        mp: 19805,
        fgm: 3144,
        fga: 6830,
        fg3m: 767,
        fg3a: 2098,
        ftm: 1346,
        fta: 1726,
        oreb: 656,
        dreb: 2861,
        ast: 1929,
        stl: 551,
        blk: 339,
        tov: 1046,
        pf: 1434,
        pts: 8401
      }
    }
  ],
  [
    1610612766,
    'CHA',
    {
      games: 82,
      team: {
        mp: 19830,
        fgm: 3093,
        fga: 7000,
        fg3m: 824,
        fg3a: 2347,
        ftm: 1591,
        fta: 1953,
        oreb: 721,
        dreb: 2853,
        ast: 1891,
        stl: 571,
        blk: 390,
        tov: 942,
        pf: 1360,
        pts: 8601
      },
      opp: {
        mp: 19830,
        fgm: 3237,
        fga: 7092,
        fg3m: 950,
        fg3a: 2576,
        ftm: 1161,
        fta: 1496,
        oreb: 732,
        dreb: 2909,
        ast: 2012,
        stl: 539,
        blk: 450,
        tov: 1071,
        pf: 1631,
        pts: 8585
      }
    }
  ]
]
