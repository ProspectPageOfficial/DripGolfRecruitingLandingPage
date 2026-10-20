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
import { colleges } from "../data/colleges.js";

const pct = (n) => `${Math.round(n * 100)}%`;
const programs = colleges.length.toLocaleString();

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
        a: html`<p>It gives a junior golfer two things: a personal recruiting page
          (bio, tournament results and stats behind one link you can send any
          coach) and <b>College Best Fit</b>, a 0&ndash;100 score showing how
          well the golfer lines up with ${programs} college golf programs.</p>`,
      },
      {
        q: "My child is not a Drip Golf member. Can they still sign up?",
        a: html`<p>Yes. Anyone can create an account &mdash; membership is not
          required. The only differences are:</p>
          <ul>
            <li><b>Price.</b> Non-members pay the standard rate. Drip Golf
              Premium members get 50% off every month and the setup fee
              waived.</li>
            <li><b>Autofill.</b> When a Drip Golf Tour player types their name
              at sign-up, we can fill in what the tour already knows (hometown,
              class year, scoring average, age and JGS rank). Everyone else
              simply types those details in. It takes a minute or two longer
              and the finished page is exactly the same.</li>
          </ul>`,
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
        q: "We play on the Drip Golf Tour but the sign-up didn't find us.",
        a: html`<p>The name lookup searches every Drip Golf Tour season, but it
          matches on the name as it appears in the tour standings. Try the
          name exactly as it is listed there (for example "Will" vs.
          "William"). If it still doesn't appear, just fill in the fields
          yourself &mdash; nothing about the account depends on the lookup.</p>`,
      },
      {
        q: "Does it work for girls' golf?",
        a: html`<p>Yes. At sign-up you choose men's or women's golf, and College
          Best Fit only lists schools that field that team.</p>`,
      },
    ],
  },
  {
    group: "College Best Fit scoring",
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
        q: "Where do we find our JGS national rank? What if we don't have one?",
        a: html`<p>It is on your golfer's profile at Junior Golf Scoreboard
          (juniorgolfscoreboard.com). Drip Golf Tour players can usually have
          it filled in for them at sign-up.</p>
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
          <p>The roster ranks behind Athletic Fit are <b>estimates</b> for most
          programs, based on the school's conference, and are marked "est." on
          screen. Treat fit scores as a starting point for building a list,
          not as a measurement. The <a href="#/data">data sources page</a>
          shows exactly what is real and what is estimated.</p>`,
      },
      {
        q: "Does a high fit score mean my child will be recruited?",
        a: html`<p>No. A fit score says how your golfer's numbers compare with a
          program's &mdash; it can't account for roster openings, a coach's
          needs or timing. Use it to decide where to reach out, then let the
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
