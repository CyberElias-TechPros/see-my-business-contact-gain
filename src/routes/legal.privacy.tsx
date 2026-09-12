import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DataRequestLink,
  OperatorNotice,
  POLICY_UPDATED,
  PolicyDocument,
  PolicyList,
  PolicySection,
} from "@/components/site/LegalDocument";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { publicConfig } from "@/lib/public-config";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy notice — GainHub NG" },
      {
        name: "description",
        content:
          "How GainHub NG collects, uses, discloses, secures and retains personal data across accounts, enquiries, listings and moderation workflows.",
      },
      { property: "og:title", content: "Privacy notice — GainHub NG" },
      {
        property: "og:description",
        content: "A plain-language explanation of GainHub NG personal-data practices and choices.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal · Privacy"
        title="Your information should have a clear route."
        subtitle={`Last updated ${POLICY_UPDATED}. This notice explains the data used to operate GainHub NG and the choices available to you.`}
      />
      <div>
        <PolicyDocument>
          <OperatorNotice />

          <PolicySection id="scope" title="1. Who this notice covers">
            <p>
              This notice applies to visitors, account holders, people who contact a listed
              business, listing applicants, business owners, reviewers, reporters and contact-circle
              participants using GainHub NG. GainHub NG is a service name; the configured deploying
              operator is the organisation responsible for the service.
            </p>
            <p>
              A listed business is independently responsible for information it receives and uses
              outside GainHub NG, including a conversation continued by phone or WhatsApp. Ask that
              business about its own privacy practices where appropriate.
            </p>
          </PolicySection>

          <PolicySection id="data" title="2. Information we collect">
            <PolicyList>
              <li>
                <strong className="text-foreground">Account data:</strong> name, email address,
                Nigerian phone number, role, account status and password-verification material. We
                store a salted password derivation, not the password itself.
              </li>
              <li>
                <strong className="text-foreground">Business and listing data:</strong> business
                name, description, category, service location, public address or service area,
                contact channels, opening hours, website, photographs and ownership relationships.
              </li>
              <li>
                <strong className="text-foreground">Conversations and feedback:</strong> enquiry
                contact details and message, ratings, review text, saved listings, correction
                suggestions and the records needed to attribute them.
              </li>
              <li>
                <strong className="text-foreground">Trust and moderation data:</strong> reports,
                claim details, private supporting files, review decisions, contact-circle proposals,
                applications, membership state and personal-data requests.
              </li>
              <li>
                <strong className="text-foreground">Security and usage data:</strong> request IDs,
                account-linked audit actions, contact-channel events and salted hashes derived from
                network addresses for rate limiting and abuse prevention. The event store does not
                need a plain network address to count an interaction.
              </li>
            </PolicyList>
            <p>
              We receive data directly from you, from a business owner or authorised representative,
              from someone submitting a correction or report, and from the infrastructure that
              safely delivers the service. Do not upload passwords, one-time codes, full
              payment-card details, medical records or identity documents unless a claim workflow
              specifically asks for relevant evidence.
            </p>
          </PolicySection>

          <PolicySection id="use" title="3. Why we use information">
            <PolicyList>
              <li>Provide accounts, directory search, listings, enquiries and owner workspaces.</li>
              <li>Route an enquiry to the owner of the business the sender selected.</li>
              <li>Review listing applications, ownership claims, reports and corrections.</li>
              <li>Operate explicit opt-in contact circles and enforce their published rules.</li>
              <li>
                Secure sessions, limit abuse, investigate incidents and keep accountable records.
              </li>
              <li>Respond to personal-data requests and meet applicable legal obligations.</li>
              <li>
                Measure contact-channel use in aggregate so owners can understand genuine interest.
              </li>
            </PolicyList>
            <p>
              Depending on the activity and applicable law, processing is based on steps requested
              by you or performance of a service, consent, compliance with law, or legitimate
              interests such as security, moderation and improving directory reliability. Where
              processing relies on consent, you may withdraw it for future use without affecting
              earlier lawful processing.
            </p>
          </PolicySection>

          <PolicySection id="public" title="4. What becomes public">
            <p>
              Published business profiles, approved reviews and aggregate ratings are public. A
              profile may include business contact channels and a public address or service area
              that an applicant supplied for publication. Do not submit a home address or personal
              number unless you are authorised and intend it to be public.
            </p>
            <p>
              Password material, session tokens, enquiry sender details, report contact details,
              claim evidence, room applications and member contact information are not public
              profile fields. Contact-circle pages expose purpose, rules, capacity and aggregate
              membership—not a downloadable phone list or private address book.
            </p>
          </PolicySection>

          <PolicySection id="sharing" title="5. When information is disclosed">
            <PolicyList>
              <li>
                The selected business owner can see the name, phone number and message supplied in
                an enquiry to that business.
              </li>
              <li>
                Authorised moderators can access records needed to evaluate applications, claims,
                reports and personal-data requests.
              </li>
              <li>
                Hosting, database, object-storage and delivery providers process data under our
                instructions to run the service. The intended architecture uses Vercel for the web
                application and Cloudflare for API, database and private evidence storage.
              </li>
              <li>
                Information may be disclosed where required by valid law, to protect people or the
                service, or as part of a corporate transaction with appropriate safeguards.
              </li>
            </PolicyList>
            <p>
              We do not describe the service as selling personal data, and it is not built to do so.
            </p>
          </PolicySection>

          <PolicySection id="retention" title="6. How long information is kept">
            <p>
              Active accounts, published listings, membership relationships and unresolved workflow
              records remain while needed to provide the service. Sessions expire after no more than
              30 days. Rate-limit buckets expire shortly after their configured window and are
              removed by daily maintenance.
            </p>
            <PolicyList>
              <li>Raw contact-channel event records are deleted after 180 days.</li>
              <li>
                Private claim files are deleted 180 days after an approval or rejection; the
                decision record remains for ownership accountability.
              </li>
              <li>
                Audit events and completed or rejected application, suggestion, report, review and
                personal-data-request records are deleted after 400 days.
              </li>
            </PolicyList>
            <p>
              A longer period may apply where a record is still contested or preservation is
              required by law. A valid deletion request is assessed against account operation,
              safety, disputes and legal obligations rather than silently treated as an immediate
              purge.
            </p>
          </PolicySection>

          <PolicySection id="security" title="7. How information is protected">
            <p>
              Controls include encrypted transport, secure HTTP-only session cookies, hashed session
              tokens, salted password derivation, origin and request-intent checks for mutations,
              rate limiting, role checks, bounded validation, private object storage for evidence
              and server-side audit records. Access is limited by role and purpose.
            </p>
            <p>
              No online service can promise absolute security. Use a unique password, protect your
              device, verify who you are speaking with before sharing sensitive information, and
              report suspected account misuse promptly.
            </p>
          </PolicySection>

          <PolicySection id="transfers" title="8. International processing">
            <p>
              Infrastructure providers may process data outside Nigeria. The operator must evaluate
              those locations and use appropriate contractual, organisational and technical
              safeguards under applicable Nigerian data-protection law, including the Nigeria Data
              Protection Act 2023, before public launch.
            </p>
          </PolicySection>

          <PolicySection id="rights" title="9. Your choices and rights">
            <p>
              Depending on your circumstances and applicable law, you may ask for access, a portable
              copy, correction or deletion; object to or restrict certain processing; withdraw
              consent; or raise a concern with the relevant data-protection authority. We may need
              to verify identity and may retain limited records where law or a legitimate safety
              need requires it.
            </p>
            <p>
              <DataRequestLink />. Signing in ties the request to the account without asking you to
              send sensitive identity data over an unverified channel.
            </p>
            {publicConfig.privacyEmail ? (
              <p>
                People who cannot access an account may email{" "}
                <a
                  className="link-underline font-medium text-primary"
                  href={`mailto:${publicConfig.privacyEmail}`}
                >
                  {publicConfig.privacyEmail}
                </a>
                .
              </p>
            ) : null}
          </PolicySection>

          <PolicySection id="children" title="10. Children">
            <p>
              GainHub NG is intended for adults and authorised business representatives, not for
              children. Do not create an account or submit personal information if you are under 18.
              If the operator learns that a child&apos;s data was submitted improperly, it will be
              assessed and removed where required.
            </p>
          </PolicySection>

          <PolicySection id="changes" title="11. Changes and contact">
            <p>
              Material changes will be reflected by updating the date above and, where appropriate,
              providing an additional notice. Previous wording should be retained in deployment
              history for accountability.
            </p>
            <p>
              For a safety or listing concern, use the{" "}
              <Link className="link-underline font-medium text-primary" to="/report">
                private report form
              </Link>
              . For personal-data matters, use the route in section 9 or the configured privacy
              address shown above.
            </p>
          </PolicySection>
        </PolicyDocument>
      </div>
    </PublicShell>
  );
}
