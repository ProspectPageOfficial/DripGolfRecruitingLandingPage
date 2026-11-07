/**
 * views/faq.js — answers to what parents and golfers ask before signing up.
 *
 * Questions are data, not markup: adding one is one entry in FAQ. Every number
 * quoted about scoring is read from lib/fit.js rather than typed here, so the
 * day a weight or tier cutoff changes, this page changes with it instead of
 * quietly describing a model that no longer exists.
 */
import { html, raw } from "../lib/dom.js";
import { WEIGHTS, TIERS, ACADEMIC_GATE } from "../lib/fit.js";

const pct = (n) => `${Math.round(n * 100)}%`;

/**
 * Grouped so a parent scanning for "price" does not wade through scoring
 * maths. Answers are trusted, hand-written HTML -- hence raw() at render time.
 */
const FAQ = [
  {
    group: "Getting started",
    items: [
      {
        q: "What is Drip Golf Recruiting?",
        a: html`<p>Drip Golf Recruiting is a tool that helps junior golfers
          build and share a golf resume as they move through their journey.
          Every player&rsquo;s goals are different: some are preparing for
          college recruiting, some want to introduce themselves to potential
          sponsors, and others are building a profile for invitational
          tournament applications. The platform gives players and families one
          place to tell their story and present their experience for the
          opportunities that fit their goals.</p>`,
      },
      {
        q: "My child is not a Drip Golf member. Can they still sign up?",
        a: html`<p>Yes, the service is open to all, but we encourage you to look
          at the Drip Golf Tournament Schedule of events throughout the year,
          and other benefits at
          <a href="https://www.drip-golf.com" target="_blank" rel="noopener noreferrer">www.drip-golf.com</a>.</p>
          <p>Please see pricing model.</p>`,
      },
      {
        q: "How much does it cost?",
        a: html`<p><b>Non-members:</b> $50 a month plus a one-time $299 setup
          fee.<br /><b>Drip Golf Premium members:</b> $25 a month, with the
          $299 setup fee waived.</p>
          <p>Both plans include the personal recruiting page, College Best Fit
          scores, tournament and stat history, and a live preview of what
          coaches see.</p>`,
      },
      {
        q: "As a parent I am not very technical. Do you have support?",
        a: html`<p>Absolutely. Drip Golf Recruiting is designed to be useful for
          families at every comfort level with technology. If you need help
          setting up an account or using the platform, contact us at
          <a href="mailto:info@dripgolfrecruiting.com">info@dripgolfrecruiting.com</a>
          and we&rsquo;ll be glad to assist.</p>
          <p>Also, we will have in person help stations set up at some of our
          Drip Golf Tournaments.</p>`,
      },
      {
        q: "Where can I find my child's JGS and TUGR national rankings?",
        a: html`<p>Drip Golf Recruiting automatically pulls your child&rsquo;s
          available JGS and TUGR ranking information into their profile. The
          rankings are shown alongside those of current players in the program,
          making it easier to see how your child compares within the team.</p>`,
      },
      {
        q: "We play on the Drip Golf Tour but the sign-up didn't find us.",
        a: html`<p>The name lookup searches every Drip Golf Tour season, but it
          matches on the name as it appears in the tour standings. Try the
          name exactly as it is listed there (for example "Will" vs.
          "William"). If it still doesn't appear, just fill in the fields
          yourself &mdash; nothing about the account depends on the lookup.</p>`,
      },
      {
        q: "Does it work for girls' golf?",
        a: html`<p>Yes. At sign-up you choose men's or women's golf. College
          Best Fit then lists only schools with that team, shows that team's
          head coach, and compares your golfer with the women's roster on the
          girls' ranking scale (Junior Golf Scoreboard ranks far fewer girls
          than boys, so the numbers aren't comparable without adjusting).</p>`,
      },
    ],
  },
  {
    group: "College Best Fit scoring",
    intro: html`<p>Drip Golf Recruiting is a tool to help families organize and
      present a junior golfer&rsquo;s information. Like academic platforms such
      as <b>Scoir</b>, it can provide useful information and help you understand
      where your child may stand, but it cannot guarantee recruiting interest, a
      roster spot, or college admission.</p>
      <p>Use it as one resource in your family&rsquo;s recruiting journey,
      alongside direct communication with college coaches and each school&rsquo;s
      application process.</p>`,
    items: [
      {
        q: "How does the college scoring system work?",
        a: html`<p>Every program gets an overall score from 0 to 100, built from
          two parts:</p>
          <ul>
            <li><b>Athletic Fit (${pct(WEIGHTS.athletic)} of the score).</b> Your
              golfer's current Junior Golf Scoreboard (JGS) national rank,
              compared with the average JGS rank the players on that college's
              current roster had in their senior year of high school.</li>
            <li><b>Academic Fit (${pct(WEIGHTS.academic)} of the score).</b> GPA
              compared with the school's average (${pct(WEIGHTS.gpa)} of the
              academic part) and SAT/ACT compared with the school's average
              (${pct(WEIGHTS.testing)}).</li>
          </ul>
          <p>Golf counts for more because this is a golf recruiting tool, but
          grades still matter: if Academic Fit falls below
          ${ACADEMIC_GATE.below}, the overall score is capped at
          ${ACADEMIC_GATE.capOverall} no matter how strong the golf is. A
          great player with grades far below a school's average should not be
          told that school is a safe bet.</p>
          <p>Open any school on the College Best Fit page to see exactly which
          comparison moved its number.</p>`,
      },
      {
        q: "What do Likely, Target and Reach mean?",
        a: html`<ul>
            <li><b>Likely</b> &mdash; ${TIERS.likely} or higher. Your golfer
              compares well with that roster on both golf and academics.</li>
            <li><b>Target</b> &mdash; ${TIERS.target} to ${TIERS.likely - 1}. A
              realistic fit worth pursuing.</li>
            <li><b>Reach</b> &mdash; below ${TIERS.target}. A stretch today.
              That doesn't mean "don't apply" &mdash; it means plan for it.</li>
          </ul>
          <p>A good list usually has some of each.</p>`,
      },
      {
        q: "Why compare rankings instead of scoring averages?",
        a: html`<p>Comparing a 13-year-old's scoring average with a college team
          made up of 20-year-olds isn't fair &mdash; younger golfers would
          score near zero everywhere. Comparing JGS rank with what the roster's
          players ranked <em>when they were in high school</em> measures
          juniors against juniors, under the same ranking system.</p>`,
      },
      {
        q: "My child is young and doesn't have a GPA or SAT yet. Can they still get scores?",
        a: html`<p>Yes. Missing academics are left out, not counted as zero
          &mdash; the score is then based on golf alone. Once a GPA or test
          score is added to the recruiting page, Academic Fit switches on
          automatically. ACT scores are converted to their SAT equivalent.</p>`,
      },
      {
        q: "What if our JGS rank isn't filled in, or we don't have one?",
        a: html`<p>If your golfer's rank isn't filled in for you, you can find
          it on their profile at Junior Golf Scoreboard
          (juniorgolfscoreboard.com) and enter it at sign-up.</p>
          <p>Athletic Fit is built on it, so sign-up asks for it. A golfer
          who hasn't played a JGS-ranked event yet will need to before College
          Best Fit can score them.</p>`,
      },
      {
        q: "Does searching for a school or wanting Division I change the score?",
        a: html`<p>No. What you want and where you fit are kept separate on
          purpose. Searching narrows the list you see; it never moves a
          score.</p>`,
      },
      {
        q: "How accurate are the college numbers?",
        a: html`<p>School names, divisions, conferences, SAT averages, admission
          rates and tuition come from the NCAA member directory and the U.S.
          Department of Education's College Scorecard.</p>
          <p>Head coaches and roster sizes are read from each school's own
          athletics website. The team rankings your golfer is compared with,
          including those behind Athletic Fit, are <b>estimates</b>, based on
          the school's conference, and are marked "est." on screen. There is no
          public source for colleges' average
          GPA, so academic fit uses SAT/ACT. Treat fit scores as a starting
          point for building a list, not as a measurement. The <a href="#/data">data sources page</a>
          shows exactly what is real and what is estimated.</p>`,
      },
      {
        q: "Does a high fit score mean my child will be recruited?",
        a: html`<p>No. A fit score says how your golfer's numbers compare with a
          program's. Each school shows how many current players will have
          graduated by your golfer's first fall, but it can't know a coach's
          needs, redshirts or timing. Use it to decide where to reach out, then let the
          recruiting page and real conversations with coaches do the rest.</p>`,
      },
    ],
  },
  {
    group: "The recruiting page",
    items: [
      {
        q: "Do coaches need an account to see the page?",
        a: html`<p>No. Coaches get one public link and never sign in. Only the
          page's owner can edit it.</p>`,
      },
      {
        q: "How do we update results, GPA or other details?",
        a: html`<p>Edit them on the recruiting page itself. The dashboard and
          College Best Fit read from that page, so there is only ever one copy
          of your golfer's information &mdash; what you see is what a coach
          sees.</p>`,
      },
    ],
  },
];

const item = ({ q, a }) => html`
  <details class="faq-item">
    <summary>${q}</summary>
    <div class="faq-answer">${raw(a)}</div>
  </details>
`;

export const faqView = () => html`
  <div class="container section-tight faq">
    <span class="eyebrow">FAQ</span>
    <h1 class="serif faq-title">Questions, answered.</h1>
    <p class="muted faq-lede">
      How the site works, how College Best Fit scores colleges, and what
      changes if your golfer isn't a Drip Golf member.
    </p>

    ${raw(FAQ.map((g) => html`
      <section class="faq-group">
        <h2 class="serif">${g.group}</h2>
        ${g.intro ? raw(html`<div class="faq-group-intro">${raw(g.intro)}</div>`) : ""}
        ${raw(g.items.map(item).join(""))}
      </section>
    `).join(""))}

    <div class="card faq-cta">
      <p><b>Still have a question?</b> See a real golfer's page or start your own.</p>
      <div class="row">
        <a class="btn btn-sm" href="#/signup">Get started &rarr;</a>
        <a class="btn btn-sm btn-ghost" href="#/example">See a live example</a>
      </div>
    </div>
  </div>
`;
