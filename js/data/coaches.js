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
 *   photo         : the headshot the school publishes on that same page,
 *                   hot-linked rather than copied -- it stays the school's
 *                   image, served from the school's own CDN (SIDEARM sites go
 *                   through SIDEARM's resizer at 300px so a card never pulls
 *                   a multi-MB original). null when the school blocks
 *                   cross-site image requests (Carnegie Mellon returns 403);
 *                   the card falls back to initials then.
 *   A missing school or team means "not on file", and the UI says so.
 *
 *   Washington University (wash-u) is deliberately absent: its athletics site
 *   lists only a women's golf program as of COACHES_VERIFIED.
 */

export const COACHES_VERIFIED = "2026-09-26";

export const HEAD_COACHES = Object.freeze({
  "stanford": { men: { name: "Conrad Ray", title: "Director of Men's Golf", email: "conrad.ray@stanford.edu", phone: "650-725-2052", photo: "https://gostanford.com/imgproxy/sjkqT3SH5PSgdfZqznJiqMO0WK7OckWBCYMYDqjm6dc/rs:fit:1980:0:0:0/g:ce:0:0/q:90/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3N0YW5mb3JkLXByb2QvMjAyNC8wNS8xMy90MWw1SlFKUW85WkZNcE5NeTZDMTlFcWlBcmNLelR4OWxpRG9IM2NiLmpwZw.jpg", source: "https://gostanford.com/sports/mens-golf/roster/coaches/conrad-ray/3448" } },
  "texas": { men: { name: "John Fields", title: "Head Coach", email: "John.Fields@athletics.utexas.edu", phone: null, photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Ftexassports_com%2Fimages%2F2022%2F9%2F12%2FJohn_Fields_summer_2022_head_shot.jpg&width=300&type=webp", source: "https://texaslonghorns.com/sports/mens-golf/roster/coaches/john-fields/3800" } },
  "vanderbilt": { men: { name: "Scott Limbaugh", title: "Head Coach", email: "scott.limbaugh@vanderbilt.edu", phone: null, photo: "https://storage.googleapis.com/vucommodores-prod/2019/05/25MGOLFHSLimbaughScott.png", source: "https://vucommodores.com/staff/scott-limbaugh-2" } },
  "oklahoma-st": { men: { name: "Alan Bratton", title: "Head Coach", email: "alan.bratton@okstate.edu", phone: "(405) 269-6293", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fokstate.com%2Fimages%2F2024%2F8%2F23%2Falan_bratton.JPG&width=300&type=webp", source: "https://okstate.com/sports/mens-golf/coaches" } },
  "byu": { men: { name: "Todd Miller", title: "Head Coach", email: "todd_miller@byu.edu", phone: null, photo: "https://byucougars.com/imgproxy/H8JZioABje5A5hDVQBZ1cmed5AGG2watuzuWsoj9sVI/rs:fit:480:0:0:0/q:80/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2J5dWNvdWdhcnMtcHJvZC8yMDI2LzA4LzI4L3lwVU1TajEwb0p4Znl4RHh1cGpPTVFod0lranV6UnlNSzQwMHVRWmEuanBn.jpg", source: "https://byucougars.com/staff/todd-miller" } },

  "baylor": { men: { name: "Jean-Paul Hebert", title: "Head Coach", email: "Jean-Paul_Hebert@baylor.edu", phone: null, photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fbaylorbears.com%2Fimages%2F2026%2F6%2F2%2FJean-Paul_Hebert.jpg&width=300&type=webp", source: "https://baylorbears.com/sports/mens-golf/coaches" } },
  "colorado-st": { men: { name: "Jack Kennedy", title: "Head Coach", email: null, phone: null, photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fcsurams.com%2Fimages%2F2025%2F9%2F4%2FKennedy__Jack_HS25.jpg&width=300&type=webp", source: "https://csurams.com/sports/mens-golf/coaches" } },
  "denver": { men: { name: "Gary Bissell", title: "Head Men's Golf Coach", email: "gary.bissell@du.edu", phone: "303-871-2512", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdenverpioneers.com%2Fimages%2F2023%2F9%2F27%2FBissell_Gary_Croped.jpg&width=300&type=webp", source: "https://denverpioneers.com/sports/mens-golf/coaches" } },
  "furman": { men: { name: "Matt Davidson", title: "Head Coach", email: "Matthew.Davidson@Furman.edu", phone: "864-294-6283", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Ffurmanpaladins.com%2Fimages%2F2025%2F9%2F6%2FDavidsonM_25.jpg&width=300&type=webp", source: "https://furmanpaladins.com/sports/golf/coaches" } },
  "north-texas": { men: { name: "Luke Calcatera", title: "Head Coach", email: "Luke.Calcatera@unt.edu", phone: "479-857-9824", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fmeangreensports.com%2Fimages%2F2024%2F3%2F5%2F030524_MG_Headshots_Luke_Calcatara_ZDB_001.JPG&width=300&type=webp", source: "https://meangreensports.com/sports/mens-golf/coaches" } },
  "kent-state": { men: { name: "Jon Mills", title: "Head Coach", email: "jmills1@kent.edu", phone: "330-672-4629", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fkentstatesports.com%2Fimages%2F2026%2F9%2F3%2F___1_.jpg&width=300&type=webp", source: "https://kentstatesports.com/sports/mens-golf/coaches" } },
  "sacred-hrt": { men: { name: "Matthew McGreevy", title: "Head Coach", email: "mcgreevym@sacredheart.edu", phone: "(203) 814-4735", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fsacredheartpioneers.com%2Fimages%2F2026%2F9%2F3%2FMatthew_McGreevy_26.jpg&width=300&type=webp", source: "https://sacredheartpioneers.com/sports/mens-golf/coaches" } },

  "lynn": { men: { name: "Steve LeBrun", title: "Head Coach, Men's Golf", email: "SLeBrun@lynn.edu", phone: "(561) 237-7712", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Flynnfightingknights.com%2Fimages%2F2026%2F9%2F1%2FLebrun_Steve_500x715_WEBHEAD.jpg.png&width=300&type=webp", source: "https://lynnfightingknights.com/sports/mens-golf/coaches" } },
  "barry": { men: { name: "Juan Yumar", title: "Head Coach", email: "jyumar@barry.edu", phone: "305-899-3061", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fbarry.sidearmsports.com%2Fimages%2F2026%2F8%2F12%2FJuan_Yumar_2026-27_002.jpg&width=300&type=webp", source: "https://gobarrybucs.com/sports/mens-golf/coaches" } },
  "cal-st-mb": { men: { name: "Jason Owen", title: "Head Men's Golf Coach", email: "jowen@csumb.edu", phone: "(831) 582-4258", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fotterathletics.com%2Fimages%2F2022%2F11%2F10%2Fowen_jason_022_csumb_athletics_staff_092322.jpg&width=300&type=webp", source: "https://otterathletics.com/sports/mens-golf/coaches" } },
  "mo-southern": { men: { name: "Taylor Griffith", title: "Head Men's and Women's Golf Coach", email: "griffith-t@mssu.edu", phone: null, photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fmssu.sidearmsports.com%2Fimages%2F2024%2F8%2F7%2F53908341660_e5afdf373b_k.jpg&width=300&type=webp", source: "https://mssulions.com/sports/mens-golf/coaches" } },
  "west-fla": { men: { name: "Steve Fell", title: "Head Coach", email: "sfell@uwf.edu", phone: "850-474-3005", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fuwf.sidearmsports.com%2Fimages%2F2025%2F9%2F23%2FFell_bmU7U.jpg&width=300&type=webp", source: "https://goargos.com/sports/mens-golf/coaches" } },

  "carnegie": { men: { name: "Dan Rodgers", title: "Head Coach", email: "rodgersd@andrew.cmu.edu", phone: "412-268-2213", photo: null, source: "https://athletics.cmu.edu/sports/mgolf/coaches/index" } },
  "emory": { men: { name: "John Sjoberg", title: "Director of Golf", email: "jsjober@emory.edu", phone: "404-712-4538", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Femoryathletics.com%2Fimages%2F2025%2F9%2F3%2FJohnSjoberg-COACH.JPG&width=300&type=webp", source: "https://emoryathletics.com/staff-directory/john-sjoberg/19" } },
  "methodist": { men: { name: "Steve Conley", title: "Head Men's Golf Coach", email: "sconley@methodist.edu", phone: "910-630-7146", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fmumonarchs.com%2Fimages%2F2025%2F9%2F15%2F_MET4044.jpg&width=300&type=webp", source: "https://mumonarchs.com/sports/mens-golf/coaches" } },
  "adrian": { men: { name: "Brent Greenwood", title: "Head Golf Coach", email: "bgreenwood@adrian.edu", phone: "(517) 265-5161 ext. 4875", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fadrianbulldogs.com%2Fimages%2F2022%2F10%2F4%2FGreenwood_Brent_4562.jpg&width=300&type=webp", source: "https://adrianbulldogs.com/sports/mens-golf/coaches" } },
  "trinity-tx": { men: { name: "Sean Etheredge", title: "Director of Golf; Head Men's Golf Coach", email: "sethered@trinity.edu", phone: "210-999-8046", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Ftrinitytigers.com%2Fimages%2F2025%2F8%2F28%2FEthredge_Sean_MGOLF25_AAB00570.jpg&width=300&type=webp", source: "https://trinitytigers.com/sports/mens-golf/coaches" } },

  "keiser": { men: { name: "Brandon Miller", title: "Head Men's and Women's Golf Coach", email: "bmiller@keiseruniversity.edu", phone: "561-681-7988", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fkeiser.sidearmsports.com%2Fimages%2F2021%2F7%2F27%2FBrandon_Miller.jpg&width=300&type=webp", source: "https://kuseahawks.com/sports/mens-golf/coaches" } },
  "dalton-st": { men: { name: "Ben Rickett", title: "Head Coach", email: "brickett@daltonstate.edu", phone: "706-712-8256", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fdaltonstate.sidearmsports.com%2Fimages%2F2025%2F8%2F25%2FBen_Rickett.jpg&width=300&type=webp", source: "https://dsroadrunners.com/sports/mens-golf/coaches" } },
  "ok-city": { men: { name: "Blake Trimble", title: "Head Men's Golf Coach", email: "btrimble@okcu.edu", phone: "(405) 208-5303", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Focusports.com%2Fimages%2F2025%2F8%2F15%2FBlake_Trimble.jpg&width=300&type=webp", source: "https://www.ocusports.com/sports/mens-golf/coaches" } },
  "texas-wes": { men: { name: "Kevin Long", title: "Men's Head Golf Coach", email: "kevinlong@txwes.edu", phone: "817-531-4210", photo: "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Framsports.net%2Fimages%2F2026%2F9%2F19%2FLong__Kevin.JPG&width=300&type=webp", source: "https://ramsports.net/sports/mens-golf/coaches" } },
});
