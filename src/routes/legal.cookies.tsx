import { createFileRoute, Link } from "@tanstack/react-router";
import {
  POLICY_UPDATED,
  PolicyDocument,
  PolicyList,
  PolicySection,
} from "@/components/site/LegalDocument";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie notice — GainHub NG" },
      {
        name: "description",
        content:
          "A concise record of the strictly necessary session cookie used by GainHub NG and the browser storage the current product does not use.",
      },
      { property: "og:title", content: "Cookie notice — GainHub NG" },
      {
        property: "og:description",
        content: "What GainHub NG stores in your browser, why it is needed and how to remove it.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal · Cookies"
        title="One essential cookie. No advertising trackers."
        subtitle={`Last updated ${POLICY_UPDATED}. This notice describes the current application—not a future analytics or advertising stack.`}
      />
      <div>
        <PolicyDocument>
          <Card className="card-surface overflow-hidden">
            <CardContent className="p-0">
              <div className="grid gap-px bg-border sm:grid-cols-[1.1fr_1fr_2fr_0.8fr]">
                {[
                  ["Cookie", "__Host-gh_session"],
                  ["Type", "Strictly necessary"],
                  ["Purpose", "Keeps an account signed in and authorises private routes"],
                  ["Lifetime", "Up to 30 days"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-card p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">
                      {label}
                    </p>
                    <p className="mt-2 break-words text-sm leading-6">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <PolicySection id="meaning" title="1. What a cookie is">
            <p>
              A cookie is a small value a website asks a browser to return on later requests. The
              current GainHub NG application uses one first-party cookie after successful account
              registration or sign-in. Browsing public pages does not require that cookie.
            </p>
          </PolicySection>

          <PolicySection id="session" title="2. How the session cookie works">
            <PolicyList>
              <li>
                <strong className="text-foreground">HttpOnly:</strong> browser scripts cannot read
                the cookie.
              </li>
              <li>
                <strong className="text-foreground">Secure:</strong> production browsers send it
                only over HTTPS.
              </li>
              <li>
                <strong className="text-foreground">SameSite=Lax:</strong> this limits cross-site
                sending while preserving ordinary navigation.
              </li>
              <li>
                <strong className="text-foreground">Path=/ and host-only:</strong> it applies to
                this site and is not shared across arbitrary subdomains.
              </li>
              <li>
                <strong className="text-foreground">Opaque value:</strong> the browser holds a
                random token; the database stores only its SHA-256 hash.
              </li>
            </PolicyList>
            <p>
              The server may expire or revoke a session earlier for sign-out, account restriction,
              security or maintenance. Expired server-side session records are removed by scheduled
              cleanup.
            </p>
          </PolicySection>

          <PolicySection id="not-used" title="3. What the current product does not set">
            <p>The repository does not currently set:</p>
            <PolicyList>
              <li>advertising, retargeting or cross-site tracking cookies;</li>
              <li>analytics cookies;</li>
              <li>personalisation or preference cookies; or</li>
              <li>third-party social-media pixels.</li>
            </PolicyList>
            <p>
              Contact-channel events used for business workspace totals rely on a salted,
              one-directional network-address hash rather than an advertising cookie. Public links
              to WhatsApp or other external services may lead to sites with their own cookie
              practices.
            </p>
          </PolicySection>

          <PolicySection id="choice" title="4. Your controls">
            <p>
              Because the session cookie is strictly necessary for requested account functions, the
              current application does not show a cosmetic “accept cookies” banner. You can refuse
              or delete it in browser settings, but sign-in, saved listings, claims, owner
              workspaces and other private routes will stop working or sign you out.
            </p>
            <p>
              You can also use the in-product sign-out action, which asks the server to revoke the
              current session and clear the cookie.
            </p>
          </PolicySection>

          <PolicySection id="change" title="5. If this changes">
            <p>
              New non-essential browser storage must not be introduced silently. This notice and the
              product&apos;s consent controls must be updated before optional analytics, advertising
              or preference cookies are enabled where consent is required.
            </p>
            <p>
              See the{" "}
              <Link className="link-underline font-medium text-primary" to="/legal/privacy">
                privacy notice
              </Link>{" "}
              for the wider data lifecycle.
            </p>
          </PolicySection>
        </PolicyDocument>
      </div>
    </PublicShell>
  );
}
