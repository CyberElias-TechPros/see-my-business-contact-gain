import { createFileRoute, Link } from "@tanstack/react-router";
import {
  OperatorNotice,
  POLICY_UPDATED,
  PolicyDocument,
  PolicyList,
  PolicySection,
} from "@/components/site/LegalDocument";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { publicConfig } from "@/lib/public-config";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use — GainHub NG" },
      {
        name: "description",
        content:
          "The rules for using GainHub NG accounts, directory listings, enquiries, reviews, ownership claims and opt-in contact circles.",
      },
      { property: "og:title", content: "Terms of use — GainHub NG" },
      {
        property: "og:description",
        content:
          "Plain-language rules for customers, business owners and contributors using GainHub NG.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal · Terms"
        title="Useful connections need ground rules."
        subtitle={`Last updated ${POLICY_UPDATED}. These terms apply when you browse, create an account, submit information or use a business workflow.`}
      />
      <div>
        <PolicyDocument>
          <OperatorNotice />

          <PolicySection id="agreement" title="1. Agreement and eligibility">
            <p>
              These terms form an agreement between you and the configured operator of GainHub NG.
              By using the service, you agree to these terms and the privacy notice. If you use the
              service for an organisation, you confirm that you are authorised to act for it.
            </p>
            <p>
              You must be at least 18 and legally able to enter this agreement. Do not use the
              service if these terms do not work for you or your use is prohibited by applicable
              law.
            </p>
          </PolicySection>

          <PolicySection id="service" title="2. What GainHub NG provides">
            <p>
              GainHub NG is a local-business directory and lead-routing service. It supports search,
              business profile applications, direct enquiry routing, saved listings, reviews,
              ownership claims, safety reports, a minimal owner workspace and explicitly opt-in
              business contact circles.
            </p>
            <p>
              GainHub NG is not a party to the contract between a customer and a listed business. It
              does not employ listed providers, hold customer money, guarantee a quote or outcome,
              or replace your own checks. Phone, website and WhatsApp services are operated by third
              parties under their own terms.
            </p>
          </PolicySection>

          <PolicySection id="accounts" title="3. Accounts and security">
            <PolicyList>
              <li>Supply accurate, current registration information and keep it up to date.</li>
              <li>Use your own account; do not sell, share or impersonate another account.</li>
              <li>Protect your password, devices and one-time codes.</li>
              <li>Tell the operator promptly if you suspect unauthorised access.</li>
              <li>
                You are responsible for activity carried out through your account unless applicable
                law provides otherwise.
              </li>
            </PolicyList>
            <p>
              The service may require a fresh sign-in or identity evidence before a sensitive
              request is actioned. Authentication does not by itself prove ownership of a particular
              business.
            </p>
          </PolicySection>

          <PolicySection id="listings" title="4. Listings, claims and verification labels">
            <p>
              A listing applicant or claimant must be authorised to publish and manage the supplied
              business information. Submitted names, contacts, addresses, media and claims must be
              accurate, lawful and not infringe another person&apos;s rights. Applications are
              reviewed; submission does not guarantee publication or a particular position in
              search.
            </p>
            <p>
              Verification labels communicate only the check described by that label—for example,
              review of contact or documentary evidence at a point in time. They are not an
              endorsement, licence check, financial guarantee or promise of future performance.
              Customers should agree scope, price and payment terms directly with a provider.
            </p>
            <p>
              Ownership-claim files must be relevant, authentic and safe to process. Claim evidence
              is private moderation material, not public listing content. Do not submit someone
              else&apos;s identity documents without authority.
            </p>
          </PolicySection>

          <PolicySection id="enquiries" title="5. Enquiries, contacts and transactions">
            <p>
              When you submit an enquiry, you direct GainHub NG to make the supplied name, phone
              number and message available to the selected business owner. You choose whether to
              continue on WhatsApp, by phone or elsewhere. Check the recipient before disclosing
              more information.
            </p>
            <PolicyList>
              <li>Never send passwords, one-time codes or full payment credentials.</li>
              <li>Get important terms in writing and keep transaction records.</li>
              <li>Use traceable payment methods appropriate to the transaction.</li>
              <li>
                Report suspicious conduct, but contact emergency services or the appropriate
                authority where immediate harm or crime is involved.
              </li>
            </PolicyList>
          </PolicySection>

          <PolicySection id="reviews" title="6. Reviews and other contributions">
            <p>
              Reviews, corrections, reports and proposals must reflect a genuine experience or a
              reasonable, good-faith concern. Separate fact from opinion. Do not publish
              confidential information, unrelated personal data, threats, hate, harassment, paid
              manipulation or defamatory statements.
            </p>
            <p>
              You retain ownership of content you submit. You grant the operator a non-exclusive,
              worldwide, royalty-free licence to host, reproduce, format, moderate and display that
              content only as needed to provide, secure, explain and promote the service. This
              licence ends when content is deleted, except for lawful backups, audit records and
              material needed to resolve a dispute.
            </p>
          </PolicySection>

          <PolicySection id="circles" title="7. Contact circles">
            <p>
              Contact circles are private, capacity-limited groups for business participants who
              apply voluntarily. A published room states its purpose, eligibility criteria and
              rules. An application is not a promise of acceptance. Member contacts must not be
              scraped, exported, sold, added to marketing lists or used outside the room&apos;s
              stated purpose.
            </p>
            <p>
              Organisers and members must respect withdrawal and room rules. GainHub NG may pause a
              room, reject an application or remove participation where needed for safety,
              integrity, capacity or compliance.
            </p>
          </PolicySection>

          <PolicySection id="prohibited" title="8. Prohibited use">
            <p>You must not use GainHub NG to:</p>
            <PolicyList>
              <li>commit fraud, impersonate a person or misrepresent ownership or credentials;</li>
              <li>
                offer unlawful, dangerous, exploitative or rights-infringing goods or services;
              </li>
              <li>
                harass, discriminate, threaten, deceive or expose another person&apos;s private
                data;
              </li>
              <li>post fake reviews, buy ratings or coordinate undisclosed manipulation;</li>
              <li>
                scrape profiles or contact details, bypass access controls or probe for
                vulnerabilities;
              </li>
              <li>send spam, malware or automated traffic that degrades the service;</li>
              <li>circumvent moderation, rate limits, account restrictions or room capacity; or</li>
              <li>
                use service content to train or enrich a contact database without written
                permission.
              </li>
            </PolicyList>
          </PolicySection>

          <PolicySection id="moderation" title="9. Review, enforcement and appeals">
            <p>
              The operator may review, limit, correct, unpublish or remove content and may restrict
              or close an account where reasonably needed to apply these terms, protect users,
              comply with law or secure the service. Automated validation and risk flags may help
              order a queue, but they do not establish guilt or guarantee an outcome.
            </p>
            <p>
              Where appropriate, affected users may provide context through the report or ownership
              claim workflow. There is no published response-time guarantee; priority depends on
              risk, evidence and available moderation capacity.
            </p>
          </PolicySection>

          <PolicySection id="fees" title="10. Fees and promotions">
            <p>
              The current application accepts free listing applications and does not include a live
              paid checkout, subscription or advertising purchase flow. A displayed future plan or
              expression-of-interest page is not an offer, invoice or entitlement. If paid services
              launch, the operator must publish the price, taxes, renewal, cancellation and refund
              terms before taking payment.
            </p>
            <p>
              Search position and verification must not be described as purchasable unless a future
              product explicitly and transparently says otherwise. Any sponsored placement must be
              visibly labelled.
            </p>
          </PolicySection>

          <PolicySection id="availability" title="11. Availability and changes">
            <p>
              The service may change, experience interruptions or withdraw a feature. Reasonable
              care is taken to preserve data and communicate material changes, but uninterrupted or
              error-free availability is not promised. Preview profiles are clearly labelled and are
              not live business endorsements.
            </p>
          </PolicySection>

          <PolicySection id="disclaimers" title="12. Responsibility and liability">
            <p>
              To the extent permitted by applicable law, the service and user-supplied information
              are provided on an “as available” basis. The operator does not warrant that every
              profile, review, price, opening hour, credential or external link is complete or
              current. Nothing here excludes liability that cannot lawfully be excluded, including
              rights available to consumers under applicable law.
            </p>
            <p>
              Users remain responsible for their own content, business decisions and transactions.
              Any limitation in these terms applies only to the extent permitted by applicable law.
            </p>
          </PolicySection>

          <PolicySection id="law" title="13. Governing law and disputes">
            {publicConfig.governingLaw && publicConfig.disputeForum ? (
              <>
                <p>
                  These terms and non-contractual matters connected with them are governed by{" "}
                  {publicConfig.governingLaw}, without displacing any mandatory protection that
                  applies to you.
                </p>
                <p>
                  Subject to any mandatory right to use another forum, disputes that cannot be
                  resolved directly will be submitted to {publicConfig.disputeForum}.
                </p>
              </>
            ) : (
              <p>
                Governing-law and dispute-forum wording has not been configured in this development
                environment. The production build refuses to deploy until reviewed wording is
                supplied.
              </p>
            )}
          </PolicySection>

          <PolicySection id="ending" title="14. Ending use and changes to these terms">
            <p>
              You may stop using the service and request account-data deletion through the available
              data request route. Some information may be retained where necessary for safety,
              disputes or law. The operator may end access for a material or repeated breach,
              subject to applicable law.
            </p>
            <p>
              Material term changes will update the date above and may receive an additional notice.
              Continued use after an effective update constitutes acceptance only where legally
              valid; fresh consent will be requested where required.
            </p>
            <p>
              Read the{" "}
              <Link className="link-underline font-medium text-primary" to="/legal/privacy">
                privacy notice
              </Link>{" "}
              for information practices, or use the{" "}
              <Link className="link-underline font-medium text-primary" to="/report">
                report form
              </Link>{" "}
              for a safety or accuracy concern.
            </p>
          </PolicySection>
        </PolicyDocument>
      </div>
    </PublicShell>
  );
}
