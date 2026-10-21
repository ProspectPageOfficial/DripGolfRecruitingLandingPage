/**
 * views/legal.js — Terms of Service (#/terms) and Privacy Policy (#/privacy).
 *
 * DRAFTS FOR LEGAL REVIEW. Written to match what the product actually does,
 * not copied from a template, but nobody who wrote them is a lawyer. Have
 * them reviewed before taking payment.
 *
 * The children's-privacy approach both documents rest on:
 *   - A PARENT OR LEGAL GUARDIAN (18+) creates and owns every account. The
 *     sign-up survey makes them confirm it (views/signup.js).
 *   - We do not knowingly let a child under 13 create an account or give us
 *     information directly. If one does, we delete it.
 *   - The parent controls the golfer's information: review, change, delete,
 *     and unpublish at any time.
 * If the product ever lets a golfer under 13 sign in themselves, these
 * documents and the consent flow have to change first (COPPA).
 *
 * Business details live in LEGAL below so the real values go in once.
 */
import { html, raw } from "../lib/dom.js";

export const LEGAL = Object.freeze({
  company: "[Company legal name, e.g. Drip Golf Recruiting LLC]",
  brand: "Drip Golf Recruiting",
  email: "[privacy / support email]",
  state: "[State]",
  effective: "[Effective date]",
});

const draftNote = () => html`
  <div class="alert alert-error legal-draft">
    <b>Draft for legal review.</b> Bracketed items still need real details,
    and this text should be checked by a lawyer before it is relied on.
  </div>
`;

const page = (eyebrow, title, body) => html`
  <div class="container section-tight legal">
    <span class="eyebrow">${eyebrow}</span>
    <h1 class="serif legal-title">${title}</h1>
    <p class="muted legal-meta">Effective ${LEGAL.effective}</p>
    ${raw(draftNote())}
    ${raw(body)}
  </div>
`;

// ---------------------------------------------------------------------------
// Privacy Policy
// ---------------------------------------------------------------------------

export const privacyView = () => page("Privacy", "Privacy Policy", html`
  <p class="legal-lede">
    ${LEGAL.brand} (“we”, “us”) helps junior golfers build a recruiting page
    and see which college golf programs fit them. Most of our golfers are
    minors, so this policy is written with parents in mind. In short:
    <b>a parent or guardian owns every account, we only collect what the
    page and the fit scores need, we never sell it, and you can delete it
    whenever you want.</b>
  </p>

  <h2>1. Children’s privacy: parents are in control</h2>
  <ul>
    <li><b>Only parents and legal guardians can create an account.</b> At
      sign-up you confirm that you are 18 or older and are the parent or legal
      guardian of the golfer. The account, the golfer’s page and everything
      on it belong to you.</li>
    <li><b>We do not knowingly collect information directly from children
      under 13.</b> A child under 13 may not create an account or send us
      information. If we learn that we have, we will delete it. If you believe
      a child under 13 has given us information, email ${LEGAL.email}.</li>
    <li><b>Golfers 13 to 17</b> may help edit their own page, but only through
      their parent’s or guardian’s account and with their permission.</li>
    <li><b>You decide what is public.</b> Your golfer’s recruiting page is
      meant to be seen by college coaches, so anything you put on it can be
      seen by anyone with the link. Beyond the golfer’s name, class year,
      team and ranking, every field is optional. We recommend not publishing
      a home address or phone number.</li>
    <li><b>Your rights over your golfer’s information.</b> At any time you can
      review it, correct it, unpublish the page, ask us to stop collecting or
      using it, or delete the account and everything in it. You can edit the
      page yourself; for anything else, email ${LEGAL.email} and we will act
      on it within 30 days.</li>
  </ul>

  <h2>2. What we collect</h2>
  <p><b>From you, the parent or guardian:</b> your email address and password
    (stored only as a secure hash), and, once payments are live, billing
    details, which our payment processor handles. We never see or store full
    card numbers.</p>
  <p><b>About your golfer, entered by you:</b> name, photo, hometown, age,
    height, weight, class year, school, GPA and test scores, golf results and
    rankings, swing videos, a written bio, social media links, and, only if
    you choose to add them, a phone number, home address and their coach’s
    contact details.</p>
  <p><b>Public golf records we look up for you:</b> when you sign up, you can
    search the Drip Golf Tour’s public standings and Junior Golf Scoreboard
    profile so we can fill in results and rankings you would otherwise type.
    You choose whether to use what we find.</p>
  <p><b>Automatically:</b> basic technical information our hosting provider
    records for every website request (such as IP address and browser type),
    used to keep the service running and secure. We do not use advertising
    trackers or sell advertising.</p>

  <h2>3. How we use it</h2>
  <ul>
    <li>To build and publish your golfer’s recruiting page.</li>
    <li>To calculate College Best Fit scores. These scores are estimates to
      help you plan, not predictions of admission or recruitment.</li>
    <li>To run your account: sign-in, billing, support and service emails.</li>
    <li>To keep the service secure and fix problems.</li>
  </ul>
  <p>We do not sell personal information, use it for advertising, or share it
    with college coaches beyond what you publish on the page.</p>

  <h2>4. Who we share it with</h2>
  <p>Only the service providers that run the product, each limited to what
    they need to do that job:</p>
  <ul>
    <li><b>Hosting and database</b> (Netlify, Supabase): store and serve the
      site, accounts, pages, photos and videos.</li>
    <li><b>Payments</b> (Stripe, once live): process subscription payments.</li>
    <li><b>Domain registrar</b>, if you choose your own web address: we
      register it on your behalf, with registrant privacy turned on where the
      registrar offers it.</li>
    <li><b>Video hosts</b> (YouTube, Vimeo), when you embed a swing video from
      them. Those services apply their own policies when the video plays.</li>
  </ul>
  <p>We may also disclose information if the law requires it, to protect
    someone’s safety, or as part of a sale or merger of the business, in which
    case this policy continues to apply to it.</p>

  <h2>5. How long we keep it</h2>
  <p>We keep your information while your account is open. When you delete the
    account, we delete the golfer’s page and information within 30 days,
    except billing records we are legally required to keep. Backups roll off
    within a further 30 days.</p>

  <h2>6. Security</h2>
  <p>Passwords are stored only as secure hashes, all connections use HTTPS,
    and each account can only edit its own golfer’s page. No system is
    perfectly secure; if a breach ever affects your information, we will tell
    you as the law requires.</p>

  <h2>7. Your state’s privacy rights</h2>
  <p>Depending on where you live, you may have additional rights, such as to
    know what we hold, get a copy, or have it deleted. We give these rights to
    every family regardless of state. Email ${LEGAL.email}.</p>

  <h2>8. Changes</h2>
  <p>If we change this policy in a way that affects how we use your golfer’s
    information, we will email you before the change takes effect.</p>

  <h2>9. Contact</h2>
  <p>${LEGAL.company}, ${LEGAL.state}. Email ${LEGAL.email}.</p>
`);

// ---------------------------------------------------------------------------
// Terms of Service
// ---------------------------------------------------------------------------

export const termsView = () => page("Terms", "Terms of Service", html`
  <p class="legal-lede">
    These terms are an agreement between you and ${LEGAL.company}
    (“${LEGAL.brand}”, “we”, “us”) for using the website and service. By
    creating an account you agree to them and to our
    <a href="#/privacy">Privacy Policy</a>.
  </p>

  <h2>1. Who can use the service</h2>
  <ul>
    <li>You must be <b>18 or older and the parent or legal guardian</b> of the
      golfer whose page you create. Accounts are for parents and guardians,
      not for golfers themselves.</li>
    <li>Children under 13 may not create an account or give us information.
      Golfers 13 to 17 may help manage their page only through their parent’s
      or guardian’s account, with permission.</li>
    <li>You are responsible for your account, for keeping your password safe,
      and for everything done through it.</li>
  </ul>

  <h2>2. Your golfer’s page and content</h2>
  <ul>
    <li>You own what you put on the page. You give us permission to store,
      display and publish it so the service works, including showing the page
      publicly at its web address.</li>
    <li>Only post information you have the right to share and that is
      accurate: results, rankings, grades and test scores should be true, and
      photos and videos must be yours to use.</li>
    <li>Do not post anything unlawful, harmful, or that could identify or
      endanger another minor without their parent’s permission.</li>
    <li>The page is public by design. Think about what you include, and leave
      out anything you would not want a stranger to see.</li>
  </ul>

  <h2>3. College Best Fit and coach information</h2>
  <ul>
    <li>Fit scores are <b>estimates</b> built from public data and modelling
      choices, some of it approximate. They are not a prediction or guarantee
      of admission, a roster spot, a scholarship, or contact from any
      coach.</li>
    <li>Coach names and contact details come from each school’s own athletics
      website and can go out of date. Check before relying on them.</li>
    <li>You are responsible for following NCAA, NAIA and other governing-body
      recruiting rules. We are not affiliated with or endorsed by the NCAA,
      any college, or Junior Golf Scoreboard.</li>
  </ul>

  <h2>4. Plans, payment and cancellation</h2>
  <ul>
    <li>Plans are billed monthly, plus a one-time setup fee where stated.
      Drip Golf Premium members receive the member price while their
      membership is active.</li>
    <li>Subscriptions renew automatically until cancelled. You can cancel at
      any time, effective at the end of the current billing period.
      [Refund policy, e.g. setup fees are non-refundable once the page is
      live.]</li>
    <li>If a web address is included with your plan, we register it on your
      behalf for as long as your subscription is active.
      [Who owns the domain if you cancel, e.g. it can be transferred to you
      on request.]</li>
    <li>We may change prices with at least 30 days’ notice by email.</li>
  </ul>

  <h2>5. Ending your account</h2>
  <p>You can delete your account at any time, which removes the golfer’s page
    as described in the Privacy Policy. We may suspend or close an account
    that breaks these terms, after notice where reasonable.</p>

  <h2>6. Disclaimers and limits</h2>
  <p>The service is provided “as is”. To the fullest extent the law allows,
    we are not liable for indirect or consequential losses, or for recruiting
    or admission outcomes, and our total liability is limited to what you
    paid us in the 12 months before the claim.</p>

  <h2>7. Changes and governing law</h2>
  <p>We may update these terms and will email you about significant changes
    before they take effect. These terms are governed by the laws of
    ${LEGAL.state}.</p>

  <h2>8. Contact</h2>
  <p>${LEGAL.company}. Email ${LEGAL.email}.</p>
`);
