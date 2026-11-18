import Link from "next/link";

type Section = { title: string; body: string[] };

const SUMMARY: string[] = [
  "You must be 18 or older to use EcoLoop.",
  "Other users see only the general area of your listing, never your exact address.",
  "We never see or store your card details. Paystack handles payments.",
  "Photos you upload are sent to an AI service to suggest a material type. You always confirm or change it.",
  "Your activity is used in the research study only in anonymised form, and only if you agree.",
  "You can ask us to withdraw your consent or delete your account at any time.",
];

const SECTIONS: Section[] = [
  {
    title: "Who we are",
    body: [
      "EcoLoop is an academic pilot built by Hephzibah Ofomi as a Software Engineering capstone project at African Leadership University. It connects manufacturers in Lagos who have reusable industrial material with businesses that want it.",
      "Questions about this policy: research@ecoloop.ng",
    ],
  },
  {
    title: "What we collect",
    body: [
      "Account details: your email, business name, phone number, date of birth, and the industrial cluster you work in.",
      "Location: the address and map point you give when you list material or set up your profile.",
      "Listings: the photos, material type, weight, and price you enter.",
      "Messages: the messages and attachments you send to other users.",
      "Deals: the status of each deal, the amount, and the payment reference. We do not collect card numbers.",
      "Your choice on research consent.",
    ],
  },
  {
    title: "How we show your location",
    body: [
      "On public listings, other users see the zone (for example, Ogba) and a map point for that zone. They do not see your exact address or exact map point.",
      "Your exact address and map point are visible only to you.",
    ],
  },
  {
    title: "Payments",
    body: [
      "Payments are processed by Paystack. Your card or bank details go to Paystack, not to EcoLoop.",
      "Before a deal is marked as paid, our server checks the payment with Paystack and confirms the amount matches the listing price. We keep only the payment reference, the amount, and the status.",
      "During the pilot, payments run in Paystack test mode and no real money moves.",
    ],
  },
  {
    title: "AI material suggestions",
    body: [
      "When you add a photo, we send it to the Hugging Face service to suggest a material type. The suggestion can be wrong.",
      "Suggestions with low confidence are flagged. You confirm or change the material before your listing goes live.",
    ],
  },
  {
    title: "Other services that handle your data",
    body: [
      "Paystack (payments), Google Maps (turning addresses into map points), Hugging Face (photo classification), Cloudinary (storing images and attachments), and our hosting providers, Vercel and Render.",
      "We do not sell your data or share it with marketers.",
    ],
  },
  {
    title: "Messages",
    body: [
      "Messages are stored on our servers and are not end-to-end encrypted. Do not send passwords or bank details in messages.",
    ],
  },
  {
    title: "Research use",
    body: [
      "EcoLoop is part of a research study. If you tick the consent box when you sign up, your platform activity may be used in the study in anonymised form (for example, SME-01, SME-02). Your name and company are not published.",
      "You can withdraw your consent at any time by emailing research@ecoloop.ng.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can view and update your profile on the Profile page.",
      "To delete your account or withdraw consent, email research@ecoloop.ng. We will delete your personal data, except records of paid or completed deals, which we keep for exchange history and dispute handling.",
    ],
  },
  {
    title: "How we protect your data",
    body: [
      "Connections to EcoLoop use HTTPS. Passwords are stored hashed, not as plain text. Payment checks happen on the server, not in your browser.",
      "No system is perfectly secure. If something affects your data, we will tell affected users.",
    ],
  },
  {
    title: "How long we keep data, and how to complain",
    body: [
      "We keep your account data while your account is active. After a deletion request, we delete your personal data, except records of paid or completed deals.",
      "If you think we have handled your data wrongly, you can complain to us at research@ecoloop.ng. You can also complain to the Nigeria Data Protection Commission.",
    ],
  },
  {
    title: "Changes to this policy",
    body: ["If we change this policy, we will update the date below."],
  },
];

export function PrivacyPolicyPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Privacy Policy</h1>
          <div className="page-sub">Last updated November 18, 2026</div>
        </div>
        <div className="page-head-actions">
          <Link href="/">Back to EcoLoop</Link>
        </div>
      </div>

      <section className="panel panel--pad" aria-labelledby="privacy-summary">
        <h2 id="privacy-summary" className="panel-label">
          The short version
        </h2>
        <ul className="panel-copy" style={{ paddingLeft: 20, margin: 0 }}>
          {SUMMARY.map((line) => (
            <li key={line} style={{ marginBottom: 6 }}>
              {line}
            </li>
          ))}
        </ul>
      </section>

      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className="panel panel--pad"
          style={{ marginTop: 14 }}
        >
          <h2 className="panel-label">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="panel-copy" style={{ margin: "8px 0 0" }}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
