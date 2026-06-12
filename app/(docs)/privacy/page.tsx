export const metadata = {
  title: "Privacy Policy | InfiniStar",
  description: "InfiniStar privacy policy — how we collect and use your data.",
}

export default function PrivacyPage() {
  return (
    <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
      <div className="flex max-w-[80%] flex-col items-start gap-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground">Last updated: June 12, 2026</p>
        <p className="text-lg text-muted-foreground">
          InfiniStar (&quot;InfiniStar&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
          operates an AI character-chat service available through our website (the
          &quot;Service&quot;). This Privacy Policy explains what information we collect when you
          use the Service, how we use and share it, and the choices and rights you have. By using
          the Service, you agree to the practices described here. If you do not agree, please do not
          use the Service.
        </p>
      </div>

      <div className="flex max-w-[80%] flex-col items-start gap-8">
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect the following categories of information when you use the Service:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Account information.</strong> When you sign up through our authentication
              provider (Clerk), we receive and store your name, email address, and avatar image,
              along with an account identifier. If you sign in with a third-party provider (for
              example, Google), we receive the profile information that provider shares. If you set
              up an optional backup password for our fallback sign-in system, we store it only as a
              secure cryptographic hash, never in plain text.
            </li>
            <li>
              <strong>Profile information.</strong> Optional details you add to your profile, such
              as a bio, location, website link, custom status, and your presence status (online,
              away, offline).
            </li>
            <li>
              <strong>Content you create.</strong> Your conversations and messages (including text,
              images you attach, voice recordings you submit for transcription and their
              transcripts), AI memories saved for you, characters you create (names, descriptions,
              greetings, system prompts, avatars), tags, message templates, and personas.
            </li>
            <li>
              <strong>Usage and analytics data.</strong> Records of how you use AI features,
              including per-request token counts and estimated costs, the models and personalities
              you use, and feature activity such as character views, likes, and usage counts.
            </li>
            <li>
              <strong>Payment information.</strong> Payments are processed by Stripe. We store your
              Stripe customer and subscription identifiers, your plan, and your billing period
              status. We never receive or store your full card number.
            </li>
            <li>
              <strong>Device and log data.</strong> Information your browser sends automatically,
              such as IP address, browser type, operating system, and the date and time of requests,
              used for security, rate limiting, and troubleshooting.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">2. How We Use Information</h2>
          <p className="text-muted-foreground">We use the information we collect to:</p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Provide and operate the Service, including delivering AI responses, syncing your
              account, and powering real-time messaging and presence features.
            </li>
            <li>Process subscription payments, creator tips, and creator subscriptions.</li>
            <li>
              Enforce usage limits (such as monthly AI message limits on the free plan) and track
              token usage for billing transparency.
            </li>
            <li>
              Keep the Service safe, including automated content moderation, rate limiting, user
              blocking, and handling content reports.
            </li>
            <li>
              Send transactional emails, such as welcome messages and account-deletion notices.
            </li>
            <li>Monitor errors and performance so we can fix problems.</li>
            <li>Comply with legal obligations and protect our rights, users, and the public.</li>
          </ul>
          <p className="text-muted-foreground">We do not sell your personal information.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">3. AI Processing</h2>
          <p className="text-muted-foreground">
            AI conversations are central to the Service. When you chat with an AI character, your
            messages, relevant conversation history, character prompts, and saved AI memories are
            sent to Anthropic (Claude models) to generate responses. Depending on the features you
            use, content may also be sent to OpenAI: voice recordings for transcription, image
            generation prompts, and message text for automated content moderation. These providers
            process your content to provide the requested functionality. Please avoid including
            sensitive personal information in conversations that you do not want processed by AI
            systems.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">4. Service Providers</h2>
          <p className="text-muted-foreground">
            We share information with the service providers below only as needed to operate the
            Service:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Clerk</strong> — authentication and account management
            </li>
            <li>
              <strong>Stripe</strong> — payment processing, subscriptions, tips
            </li>
            <li>
              <strong>Anthropic</strong> — AI conversation responses (Claude)
            </li>
            <li>
              <strong>OpenAI</strong> — voice transcription, image generation, and content
              moderation
            </li>
            <li>
              <strong>Postmark</strong> — transactional email delivery
            </li>
            <li>
              <strong>Cloudinary</strong> — image hosting and processing
            </li>
            <li>
              <strong>Pusher</strong> — real-time messaging, typing indicators, and presence
            </li>
            <li>
              <strong>Sentry</strong> — error monitoring
            </li>
            <li>
              <strong>Vercel</strong> — application hosting
            </li>
            <li>
              <strong>Neon</strong> — Postgres database hosting
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">5. Other Sharing</h2>
          <p className="text-muted-foreground">
            Beyond the providers above, we may share information in these situations:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Content you choose to share.</strong> Characters you mark as public are
              visible to other users. Conversations you share via a share link or invite are visible
              to anyone with access under the permissions you set.
            </li>
            <li>
              <strong>Legal requirements.</strong> If required by law, or where we believe in good
              faith that disclosure is necessary to comply with legal process, enforce our terms,
              prevent fraud or abuse, or protect the safety of any person.
            </li>
            <li>
              <strong>Business transfers.</strong> If we are involved in a merger, acquisition,
              financing, or sale of assets, information may be transferred as part of that
              transaction, subject to this policy.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">6. Data Retention and Deletion</h2>
          <p className="text-muted-foreground">
            We keep your information for as long as your account is active. You can manage retention
            yourself in several ways:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Delete individual messages or entire conversations at any time.</li>
            <li>
              Enable auto-delete in settings to automatically remove conversations older than a
              retention period you choose (from 7 to 365 days), with options to include archived
              conversations or exclude tagged ones.
            </li>
            <li>
              Request account deletion from your account settings. Deletion takes effect after a
              30-day grace period, during which you can cancel the request and keep your account.
              After the grace period, your account data is deleted or anonymized.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">7. Your Rights</h2>
          <p className="text-muted-foreground">
            Depending on where you live, you may have legal rights regarding your personal
            information, including under the GDPR. Regardless of location, we offer everyone the
            ability to:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Access and correct</strong> your information through your profile and account
              settings.
            </li>
            <li>
              <strong>Export</strong> your conversations in JSON, Markdown, or plain-text format,
              and export characters you created as portable character card files.
            </li>
            <li>
              <strong>Delete</strong> your account as described in Section 6, including the right to
              cancel a pending deletion during the 30-day grace period.
            </li>
            <li>
              <strong>Control communications</strong> through notification preferences in your
              settings.
            </li>
          </ul>
          <p className="text-muted-foreground">
            To exercise any other rights, or if you need help, contact us at support@infinistar.app.
            We may need to verify your identity before acting on a request.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">8. Cookies</h2>
          <p className="text-muted-foreground">
            We use cookies and similar technologies that are necessary to operate the Service, such
            as keeping you signed in, securing requests against cross-site request forgery, and
            remembering preferences like your theme. We do not use third-party advertising cookies.
            You can control cookies through your browser settings, but blocking essential cookies
            may prevent you from signing in or using parts of the Service.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">9. Security</h2>
          <p className="text-muted-foreground">
            We use commercially reasonable technical and organizational measures to protect your
            information, including encryption in transit, hashed credentials, request validation,
            rate limiting, and access controls. No method of transmission or storage is completely
            secure, so we cannot guarantee absolute security. Please use a strong, unique password
            and keep your sign-in credentials confidential.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">10. Children and Age Requirements</h2>
          <p className="text-muted-foreground">
            The Service is not directed to children under 13, and you must be at least 13 years old
            (or older where required by local law) to use it. Content marked as mature (NSFW) is
            restricted to users who are at least 18 years old and who have explicitly confirmed
            their age and enabled mature content in their safety settings. We do not knowingly
            collect personal information from children under 13. If you believe a child under 13 has
            provided us personal information, please contact us at support@infinistar.app and we
            will investigate and delete it as appropriate.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">11. International Data Transfers</h2>
          <p className="text-muted-foreground">
            We and our service providers process data in the United States and other countries that
            may have different data-protection laws than your country. By using the Service, you
            understand that your information may be transferred to and processed in those countries.
            Where required, we rely on appropriate safeguards for such transfers.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">12. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. When we do, we will post the
            updated version on this page and revise the &quot;Last updated&quot; date above. If the
            changes are material, we will provide additional notice, such as by email or an in-app
            notice. Your continued use of the Service after changes take effect means you accept the
            updated policy.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">13. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy or our data practices, contact us at
            support@infinistar.app.
          </p>
        </section>
      </div>
    </section>
  )
}
