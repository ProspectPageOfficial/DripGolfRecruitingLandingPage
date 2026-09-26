/**
 * data/coaches.js — the head coach of each program, with contact details.
 *
 * ===========================================================================
 * REAL DATA, HAND-VERIFIED. IT GOES STALE.
 * ===========================================================================
 * Unlike the stats in colleges.js, every entry here was copied from the
 * program's own official athletics staff page on COACHES_VERIFIED. `source`
 * records exactly which page, so re-verifying a row is one click.
 *
 * Coach turnover in college golf runs ~10-15% a year, so this file needs a
 * re-check at least once a season (August, before the fall schedule, is when
 * most staff changes have already been announced). The UI prints the
 * verification date next to every card so a golfer knows how fresh it is.
 *
 * FIELD NOTES
 *   Keyed by college id, then by team ("men" | "women"). Only men's staff is
 *   on file today because that is the side Luke recruits into.
 *   email / phone : null when the school does not publish one. We never guess
 *                   an address from a naming pattern -- a wrong email is worse
 *                   than none.
 *   A missing school or team means "not on file", and the UI says so.
 *
 *   Washington University (wash-u) is deliberately absent: its athletics site
 *   lists only a women's golf program as of COACHES_VERIFIED.
 */

export const COACHES_VERIFIED = "2026-09-26";

export const HEAD_COACHES = Object.freeze({
  "stanford": { men: { name: "Conrad Ray", title: "Director of Men's Golf", email: "conrad.ray@stanford.edu", phone: "650-725-2052", source: "https://gostanford.com/sports/mens-golf/roster/coaches/conrad-ray/3448" } },
  "texas": { men: { name: "John Fields", title: "Head Coach", email: "John.Fields@athletics.utexas.edu", phone: null, source: "https://texaslonghorns.com/sports/mens-golf/roster/coaches/john-fields/3800" } },
  "vanderbilt": { men: { name: "Scott Limbaugh", title: "Head Coach", email: "scott.limbaugh@vanderbilt.edu", phone: null, source: "https://vucommodores.com/staff/scott-limbaugh-2" } },
  "oklahoma-st": { men: { name: "Alan Bratton", title: "Head Coach", email: "alan.bratton@okstate.edu", phone: "(405) 269-6293", source: "https://okstate.com/sports/mens-golf/coaches" } },
  "byu": { men: { name: "Todd Miller", title: "Head Coach", email: "todd_miller@byu.edu", phone: null, source: "https://byucougars.com/staff/todd-miller" } },

  "baylor": { men: { name: "Jean-Paul Hebert", title: "Head Coach", email: "Jean-Paul_Hebert@baylor.edu", phone: null, source: "https://baylorbears.com/sports/mens-golf/coaches" } },
  "colorado-st": { men: { name: "Jack Kennedy", title: "Head Coach", email: null, phone: null, source: "https://csurams.com/sports/mens-golf/coaches" } },
  "denver": { men: { name: "Gary Bissell", title: "Head Men's Golf Coach", email: "gary.bissell@du.edu", phone: "303-871-2512", source: "https://denverpioneers.com/sports/mens-golf/coaches" } },
  "furman": { men: { name: "Matt Davidson", title: "Head Coach", email: "Matthew.Davidson@Furman.edu", phone: "864-294-6283", source: "https://furmanpaladins.com/sports/golf/coaches" } },
  "north-texas": { men: { name: "Luke Calcatera", title: "Head Coach", email: "Luke.Calcatera@unt.edu", phone: "479-857-9824", source: "https://meangreensports.com/sports/mens-golf/coaches" } },
  "kent-state": { men: { name: "Jon Mills", title: "Head Coach", email: "jmills1@kent.edu", phone: "330-672-4629", source: "https://kentstatesports.com/sports/mens-golf/coaches" } },
  "sacred-hrt": { men: { name: "Matthew McGreevy", title: "Head Coach", email: "mcgreevym@sacredheart.edu", phone: "(203) 814-4735", source: "https://sacredheartpioneers.com/sports/mens-golf/coaches" } },

  "lynn": { men: { name: "Steve LeBrun", title: "Head Coach, Men's Golf", email: "SLeBrun@lynn.edu", phone: "(561) 237-7712", source: "https://lynnfightingknights.com/sports/mens-golf/coaches" } },
  "barry": { men: { name: "Juan Yumar", title: "Head Coach", email: "jyumar@barry.edu", phone: "305-899-3061", source: "https://gobarrybucs.com/sports/mens-golf/coaches" } },
  "cal-st-mb": { men: { name: "Jason Owen", title: "Head Men's Golf Coach", email: "jowen@csumb.edu", phone: "(831) 582-4258", source: "https://otterathletics.com/sports/mens-golf/coaches" } },
  "mo-southern": { men: { name: "Taylor Griffith", title: "Head Men's and Women's Golf Coach", email: "griffith-t@mssu.edu", phone: null, source: "https://mssulions.com/sports/mens-golf/coaches" } },
  "west-fla": { men: { name: "Steve Fell", title: "Head Coach", email: "sfell@uwf.edu", phone: "850-474-3005", source: "https://goargos.com/sports/mens-golf/coaches" } },

  "carnegie": { men: { name: "Dan Rodgers", title: "Head Coach", email: "rodgersd@andrew.cmu.edu", phone: "412-268-2213", source: "https://athletics.cmu.edu/sports/mgolf/coaches/index" } },
  "emory": { men: { name: "John Sjoberg", title: "Director of Golf", email: "jsjober@emory.edu", phone: "404-712-4538", source: "https://emoryathletics.com/staff-directory/john-sjoberg/19" } },
  "methodist": { men: { name: "Steve Conley", title: "Head Men's Golf Coach", email: "sconley@methodist.edu", phone: "910-630-7146", source: "https://mumonarchs.com/sports/mens-golf/coaches" } },
  "adrian": { men: { name: "Brent Greenwood", title: "Head Golf Coach", email: "bgreenwood@adrian.edu", phone: "(517) 265-5161 ext. 4875", source: "https://adrianbulldogs.com/sports/mens-golf/coaches" } },
  "trinity-tx": { men: { name: "Sean Etheredge", title: "Director of Golf; Head Men's Golf Coach", email: "sethered@trinity.edu", phone: "210-999-8046", source: "https://trinitytigers.com/sports/mens-golf/coaches" } },

  "keiser": { men: { name: "Brandon Miller", title: "Head Men's and Women's Golf Coach", email: "bmiller@keiseruniversity.edu", phone: "561-681-7988", source: "https://kuseahawks.com/sports/mens-golf/coaches" } },
  "dalton-st": { men: { name: "Ben Rickett", title: "Head Coach", email: "brickett@daltonstate.edu", phone: "706-712-8256", source: "https://dsroadrunners.com/sports/mens-golf/coaches" } },
  "ok-city": { men: { name: "Blake Trimble", title: "Head Men's Golf Coach", email: "btrimble@okcu.edu", phone: "(405) 208-5303", source: "https://www.ocusports.com/sports/mens-golf/coaches" } },
  "texas-wes": { men: { name: "Kevin Long", title: "Men's Head Golf Coach", email: "kevinlong@txwes.edu", phone: "817-531-4210", source: "https://ramsports.net/sports/mens-golf/coaches" } },
});
