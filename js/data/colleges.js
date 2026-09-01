/**
 * data/colleges.js — the program database the Fit engine scores against.
 *
 * ===========================================================================
 * ILLUSTRATIVE DEMO DATA. THE NUMBERS ARE FABRICATED.
 * ===========================================================================
 * School names are real; every stat attached to them is invented to make the
 * demo behave believably. Do NOT ship these figures to a paying golfer.
 *
 * For production, source each field properly:
 *   teamScoringAvg  -> Clippd / Scoreboard / Golfstat team season averages
 *   recruitRank     -> Junior Golf Scoreboard / AJGA rank of committed recruits
 *   avgGPA, avgSAT  -> IPEDS Common Data Set (free, public, citable)
 *   tuition         -> IPEDS
 * Then this file becomes a `colleges` table and `rankSchools()` becomes a
 * query. The engine in lib/fit.js does not change either way -- that is the
 * whole point of keeping it pure.
 *
 * FIELD NOTES
 *   teamScoringAvg : 18-hole stroke average of the program's counting five.
 *   recruitRank    : the national junior rank this program typically signs.
 *                    Lower = more selective athletically.
 *   tuition        : sticker price per year, USD. Not net price.
 *   domain         : the school's REAL web domain, used to fetch its REAL
 *                    favicon as a logo. This is the one field here that is not
 *                    invented, which is the entire reason it is safe to render:
 *                    we display the mark the institution publishes about
 *                    itself, and never draw a crest of our own. Four rows point
 *                    at an athletics subdomain (csurams.com, athletics.cmu.edu)
 *                    because the main .edu serves a blank placeholder icon.
 */

export const DIVISIONS = ["D1", "D2", "D3", "NAIA"];
export const REGIONS = ["West", "Southwest", "Midwest", "Southeast", "Northeast"];

export const colleges = [
  // ---- D1, elite ----
  { id: "stanford",   domain: "stanford.edu", name: "Stanford University",        division: "D1", conference: "ACC",        region: "West",      type: "Private", nationalRank: 2,   teamScoringAvg: 69.8, recruitRank: 12,  avgGPA: 3.95, avgSAT: 1520, tuition: 62484, acceptRate: 4,  roster: 9 },
  { id: "texas",      domain: "utexas.edu", name: "University of Texas",        division: "D1", conference: "SEC",        region: "Southwest", type: "Public",  nationalRank: 4,   teamScoringAvg: 70.1, recruitRank: 20,  avgGPA: 3.78, avgSAT: 1400, tuition: 11752, acceptRate: 29, roster: 10 },
  { id: "vanderbilt", domain: "vanderbilt.edu", name: "Vanderbilt University",      division: "D1", conference: "SEC",        region: "Southeast", type: "Private", nationalRank: 6,   teamScoringAvg: 70.3, recruitRank: 25,  avgGPA: 3.88, avgSAT: 1500, tuition: 63946, acceptRate: 6,  roster: 9 },
  { id: "oklahoma-st",domain: "okstate.edu", name: "Oklahoma State University",  division: "D1", conference: "Big 12",     region: "Southwest", type: "Public",  nationalRank: 3,   teamScoringAvg: 69.9, recruitRank: 15,  avgGPA: 3.55, avgSAT: 1230, tuition: 26898, acceptRate: 70, roster: 10 },
  { id: "byu",        domain: "byu.edu", name: "Brigham Young University",   division: "D1", conference: "Big 12",     region: "West",      type: "Private", nationalRank: 27,  teamScoringAvg: 70.95, recruitRank: 60, avgGPA: 3.72, avgSAT: 1310, tuition: 6304,  acceptRate: 69, roster: 11 },

  // ---- D1, mid-major ----
  { id: "baylor",     domain: "baylor.edu", name: "Baylor University",          division: "D1", conference: "Big 12",     region: "Southwest", type: "Private", nationalRank: 106, teamScoringAvg: 72.4, recruitRank: 140, avgGPA: 3.65, avgSAT: 1290, tuition: 62628, acceptRate: 46, roster: 10 },
  { id: "colorado-st",domain: "csurams.com", name: "Colorado State University",  division: "D1", conference: "Mountain West", region: "West",   type: "Public",  nationalRank: 88,  teamScoringAvg: 72.0, recruitRank: 120, avgGPA: 3.45, avgSAT: 1180, tuition: 32286, acceptRate: 90, roster: 9  },
  { id: "denver",     domain: "du.edu", name: "University of Denver",       division: "D1", conference: "Summit",     region: "West",      type: "Private", nationalRank: 74,  teamScoringAvg: 71.8, recruitRank: 105, avgGPA: 3.70, avgSAT: 1300, tuition: 60000, acceptRate: 78, roster: 9  },
  { id: "furman",     domain: "furman.edu", name: "Furman University",          division: "D1", conference: "Southern",   region: "Southeast", type: "Private", nationalRank: 62,  teamScoringAvg: 71.5, recruitRank: 95,  avgGPA: 3.68, avgSAT: 1310, tuition: 58000, acceptRate: 60, roster: 10 },
  { id: "north-texas",domain: "unt.edu", name: "University of North Texas",  division: "D1", conference: "American",   region: "Southwest", type: "Public",  nationalRank: 119, teamScoringAvg: 72.7, recruitRank: 155, avgGPA: 3.40, avgSAT: 1150, tuition: 11800, acceptRate: 82, roster: 9  },
  { id: "kent-state", domain: "www.kent.edu", name: "Kent State University",      division: "D1", conference: "MAC",        region: "Midwest",   type: "Public",  nationalRank: 71,  teamScoringAvg: 71.7, recruitRank: 100, avgGPA: 3.42, avgSAT: 1130, tuition: 21000, acceptRate: 88, roster: 10 },
  { id: "sacred-hrt", domain: "sacredheart.edu", name: "Sacred Heart University",    division: "D1", conference: "MAAC",       region: "Northeast", type: "Private", nationalRank: 188, teamScoringAvg: 74.2, recruitRank: 240, avgGPA: 3.30, avgSAT: 1120, tuition: 49000, acceptRate: 66, roster: 8  },

  // ---- D2 ----
  { id: "lynn",       domain: "lynn.edu", name: "Lynn University",            division: "D2", conference: "Sunshine State", region: "Southeast", type: "Private", nationalRank: 21, teamScoringAvg: 71.9, recruitRank: 130, avgGPA: 3.25, avgSAT: 1080, tuition: 42000, acceptRate: 75, roster: 10 },
  { id: "barry",      domain: "barry.edu", name: "Barry University",           division: "D2", conference: "Sunshine State", region: "Southeast", type: "Private", nationalRank: 34, teamScoringAvg: 72.6, recruitRank: 165, avgGPA: 3.20, avgSAT: 1050, tuition: 33000, acceptRate: 63, roster: 9  },
  { id: "cal-st-mb",  domain: "csumb.edu", name: "Cal State Monterey Bay",     division: "D2", conference: "CCAA",       region: "West",      type: "Public",  nationalRank: 46,  teamScoringAvg: 73.1, recruitRank: 190, avgGPA: 3.15, avgSAT: 1030, tuition: 18000, acceptRate: 80, roster: 9  },
  { id: "mo-southern",domain: "mssu.edu", name: "Missouri Southern State",    division: "D2", conference: "MIAA",       region: "Midwest",   type: "Public",  nationalRank: 58,  teamScoringAvg: 73.6, recruitRank: 215, avgGPA: 3.05, avgSAT:  990, tuition: 15500, acceptRate: 92, roster: 8  },
  { id: "west-fla",   domain: "uwf.edu", name: "University of West Florida", division: "D2", conference: "Gulf South", region: "Southeast", type: "Public",  nationalRank: 39,  teamScoringAvg: 72.8, recruitRank: 175, avgGPA: 3.35, avgSAT: 1140, tuition: 17000, acceptRate: 55, roster: 9  },

  // ---- D3 ----
  { id: "carnegie",   domain: "athletics.cmu.edu", name: "Carnegie Mellon University", division: "D3", conference: "UAA",        region: "Northeast", type: "Private", nationalRank: 96,  teamScoringAvg: 75.4, recruitRank: 340, avgGPA: 3.90, avgSAT: 1510, tuition: 63000, acceptRate: 11, roster: 8  },
  { id: "emory",      domain: "emory.edu", name: "Emory University",           division: "D3", conference: "UAA",        region: "Southeast", type: "Private", nationalRank: 12,  teamScoringAvg: 73.5, recruitRank: 230, avgGPA: 3.85, avgSAT: 1480, tuition: 60000, acceptRate: 13, roster: 9  },
  { id: "methodist",  domain: "methodist.edu", name: "Methodist University",       division: "D3", conference: "USA South",  region: "Southeast", type: "Private", nationalRank: 1,   teamScoringAvg: 72.2, recruitRank: 150, avgGPA: 3.30, avgSAT: 1090, tuition: 37000, acceptRate: 68, roster: 12 },
  { id: "adrian",     domain: "adrian.edu", name: "Adrian College",             division: "D3", conference: "MIAA",       region: "Midwest",   type: "Private", nationalRank: 172, teamScoringAvg: 76.8, recruitRank: 430, avgGPA: 3.10, avgSAT: 1020, tuition: 39000, acceptRate: 74, roster: 10 },
  { id: "wash-u",     domain: "wustl.edu", name: "Washington University",      division: "D3", conference: "UAA",        region: "Midwest",   type: "Private", nationalRank: 44,  teamScoringAvg: 74.6, recruitRank: 290, avgGPA: 3.92, avgSAT: 1530, tuition: 62000, acceptRate: 12, roster: 8  },
  { id: "trinity-tx", domain: "trinity.edu", name: "Trinity University",         division: "D3", conference: "SCAC",       region: "Southwest", type: "Private", nationalRank: 30,  teamScoringAvg: 74.0, recruitRank: 265, avgGPA: 3.70, avgSAT: 1360, tuition: 51000, acceptRate: 32, roster: 9  },

  // ---- NAIA ----
  { id: "keiser",     domain: "keiseruniversity.edu", name: "Keiser University",          division: "NAIA", conference: "Sun",      region: "Southeast", type: "Private", nationalRank: 2,  teamScoringAvg: 71.4, recruitRank: 110, avgGPA: 3.10, avgSAT: 1020, tuition: 23000, acceptRate: 95, roster: 12 },
  { id: "dalton-st",  domain: "daltonstate.edu", name: "Dalton State College",       division: "NAIA", conference: "Southern States", region: "Southeast", type: "Public", nationalRank: 5, teamScoringAvg: 71.9, recruitRank: 135, avgGPA: 3.00, avgSAT: 1000, tuition: 8000, acceptRate: 97, roster: 10 },
  { id: "ok-city",    domain: "okcu.edu", name: "Oklahoma City University",   division: "NAIA", conference: "Sooner",   region: "Southwest", type: "Private", nationalRank: 9,  teamScoringAvg: 72.5, recruitRank: 170, avgGPA: 3.25, avgSAT: 1090, tuition: 30000, acceptRate: 71, roster: 11 },
  { id: "texas-wes",  domain: "txwes.edu", name: "Texas Wesleyan University",  division: "NAIA", conference: "Sooner",   region: "Southwest", type: "Private", nationalRank: 14, teamScoringAvg: 72.9, recruitRank: 195, avgGPA: 2.95, avgSAT:  980, tuition: 32000, acceptRate: 45, roster: 10 },
];

/** Lookup by id. O(1) beats Array.find in a render loop. */
export const collegeById = Object.fromEntries(colleges.map((c) => [c.id, c]));
