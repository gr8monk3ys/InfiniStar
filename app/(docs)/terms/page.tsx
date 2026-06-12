export const metadata = {
  title: "Terms of Service | InfiniStar",
  description: "InfiniStar terms of service — the rules for using our platform.",
}

export default function TermsPage() {
  return (
    <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
      <div className="flex max-w-[80%] flex-col items-start gap-2">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground">Last updated: June 12, 2026</p>
        <p className="text-lg text-muted-foreground">
          These Terms of Service (the &quot;Terms&quot;) are an agreement between you and InfiniStar
          (&quot;InfiniStar&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) and govern
          your access to and use of our AI character-chat service, including our website,
          applications, and related features (together, the &quot;Service&quot;). Please read them
          carefully. By creating an account or using the Service, you agree to these Terms and to
          our Privacy Policy. If you do not agree, do not use the Service.
        </p>
      </div>

      <div className="flex max-w-[80%] flex-col items-start gap-8">
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">1. Eligibility and Age Requirements</h2>
          <p className="text-muted-foreground">
            You must be at least 13 years old (or older where required by the laws of your country)
            to use the Service. Content marked as mature (NSFW) is restricted: you may only access
            it if you are at least 18 years old, have explicitly confirmed that you are an adult,
            and have enabled mature content in your safety settings. Misrepresenting your age to
            access mature content is a violation of these Terms and may result in account
            termination. If you use the Service on behalf of an organization, you represent that you
            are authorized to bind that organization to these Terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">2. Your Account</h2>
          <p className="text-muted-foreground">
            You need an account to use most of the Service. Authentication is provided through
            Clerk, and a backup email-and-password sign-in may be available as a fallback. You are
            responsible for the accuracy of your account information, for keeping your credentials
            confidential, and for all activity that occurs under your account. Notify us promptly at
            support@infinistar.app if you suspect unauthorized use of your account. We are not
            liable for losses caused by unauthorized use that results from your failure to protect
            your credentials.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">3. The Service</h2>
          <p className="text-muted-foreground">
            InfiniStar lets you chat with AI characters, create and publish your own characters,
            save AI memories, organize conversations, and use related features such as voice
            transcription, image generation, search, sharing, and export. AI responses are generated
            by third-party AI providers, including Anthropic (Claude) and, for certain features,
            OpenAI. We may add, change, suspend, or remove features at any time. We will try to give
            reasonable notice of changes that materially reduce the Service, but we are not liable
            for modifications or discontinuation of the Service or any part of it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">4. AI-Generated Content Disclaimer</h2>
          <p className="text-muted-foreground">
            Conversations on InfiniStar are with artificial-intelligence systems, not people. AI
            responses are generated automatically and are fictional in nature, even when they sound
            confident or realistic. They may be inaccurate, incomplete, offensive, or otherwise
            unreliable. Nothing produced by the Service is professional advice of any kind —
            including medical, mental-health, legal, or financial advice — and you should not rely
            on it as such. Characters are fictional personas and do not represent real people unless
            clearly stated. If you are in crisis or need professional help, contact a qualified
            professional or local emergency services. You use AI output at your own risk and are
            responsible for evaluating it before relying on it or sharing it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">5. Subscriptions and Billing</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Free plan.</strong> The free plan includes a limited number of AI messages per
              month and other limits described on our pricing page. Limits reset monthly and may
              change over time.
            </li>
            <li>
              <strong>PRO subscription.</strong> The PRO plan is a recurring paid subscription
              billed through Stripe at the price shown at checkout. It provides higher usage limits
              (subject to fair use), access to additional models, and other features described on
              our pricing page.
            </li>
            <li>
              <strong>Renewal and cancellation.</strong> Subscriptions renew automatically at the
              end of each billing period until cancelled. You can cancel at any time through the
              billing portal in your account settings. After cancellation, you keep PRO access until
              the end of your current billing period; we do not provide prorated refunds for partial
              periods except where required by law.
            </li>
            <li>
              <strong>Price changes.</strong> We may change subscription prices with advance notice.
              Price changes apply from your next billing period, and you may cancel before they take
              effect.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">6. Creator Tips and Creator Subscriptions</h2>
          <p className="text-muted-foreground">
            You may support character creators by sending one-time tips or starting recurring
            creator subscriptions, both processed through Stripe. Tips are voluntary payments and
            are generally non-refundable except where required by law or in cases of error or fraud.
            Creator subscriptions renew automatically until cancelled and can be cancelled at any
            time, with access continuing until the end of the paid period. Supporting a creator does
            not give you any rights in the creator&apos;s content beyond normal use of the Service.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">7. Your Content and Characters</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong>Ownership.</strong> You retain ownership of the content you create on the
              Service, including your messages, characters (names, descriptions, greetings, system
              prompts, and artwork you upload), templates, and personas (together, &quot;User
              Content&quot;).
            </li>
            <li>
              <strong>License to us.</strong> So that we can operate the Service, you grant
              InfiniStar a non-exclusive, worldwide, royalty-free license to host, store, process,
              reproduce, display, and transmit your User Content as needed to provide, secure, and
              improve the Service, including sending it to our AI and infrastructure providers to
              generate responses and deliver features. This license ends when your User Content is
              deleted from the Service, except as needed to comply with law or as part of routine
              backups.
            </li>
            <li>
              <strong>Public characters and shared content.</strong> If you make a character public,
              you additionally grant us and other users the right to view and interact with that
              character (including generating AI conversations with it) for as long as it remains
              public. The same applies to conversations you choose to share via links or invites,
              under the permissions you set.
            </li>
            <li>
              <strong>Your responsibility.</strong> You represent that you have the rights needed to
              submit your User Content and that it does not violate these Terms or any law. We do
              not pre-screen all content, but we may remove or restrict content that violates these
              Terms.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">8. Prohibited Content and Conduct</h2>
          <p className="text-muted-foreground">
            You may not use the Service to create, upload, share, or solicit content that:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              is illegal or promotes illegal activity, including fraud, scams, or financial crime;
            </li>
            <li>
              sexualizes or exploits minors in any way, real or fictional — child sexual abuse
              material is strictly prohibited, will result in immediate termination, and will be
              reported to the relevant authorities;
            </li>
            <li>
              harasses, threatens, or abuses others, including targeted insults or encouraging
              anyone to harm themselves;
            </li>
            <li>promotes hatred or violence against people based on protected characteristics;</li>
            <li>
              encourages or provides instructions for self-harm, suicide, or acts of violence,
              including the construction of weapons;
            </li>
            <li>constitutes spam, deceptive promotions, phishing, or other scams;</li>
            <li>
              impersonates any person or entity, or misrepresents your affiliation with anyone;
            </li>
            <li>infringes intellectual-property, privacy, or publicity rights of others;</li>
            <li>contains malware or code designed to disrupt or damage systems.</li>
          </ul>
          <p className="text-muted-foreground">In addition, you may not:</p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              circumvent age gates, safety filters, rate limits, or other technical protections;
            </li>
            <li>
              scrape the Service or access it by automated means not provided by us, or attempt to
              reverse engineer the Service;
            </li>
            <li>
              share mature (NSFW) content outside the designated, age-gated areas of the Service;
            </li>
            <li>resell, sublicense, or commercially exploit the Service without our permission.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">9. Moderation, Reporting, and Blocking</h2>
          <p className="text-muted-foreground">
            We use a combination of automated moderation (including rule-based filters and
            AI-assisted review) and user reports to detect content that violates these Terms.
            Automated systems may block messages, flag content for review, or restrict accounts. You
            can report content or users from within the Service and block users you do not want to
            interact with. We may remove content, restrict features, or suspend or terminate
            accounts at our discretion when we believe these Terms have been violated. We may
            preserve and disclose content where required by law, as described in our Privacy Policy.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">10. Intellectual Property and Feedback</h2>
          <p className="text-muted-foreground">
            The Service itself — including its software, design, branding, and all content we
            provide — is owned by InfiniStar or its licensors and is protected by
            intellectual-property laws. Except for the rights expressly granted to you in these
            Terms, we reserve all rights. If you send us feedback, suggestions, or ideas about the
            Service, you grant us the right to use them without restriction or compensation. If you
            believe content on the Service infringes your copyright, email support@infinistar.app
            with a description of the work, the location of the allegedly infringing material, your
            contact information, and a statement that you believe in good faith the use is
            unauthorized; we will review and respond appropriately.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">11. Privacy</h2>
          <p className="text-muted-foreground">
            Our collection and use of personal information is described in our Privacy Policy, which
            is incorporated into these Terms. In short: your conversations are processed by
            third-party AI providers to generate responses, payments are handled by Stripe, and you
            have tools to export your data and delete your account.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">12. Termination</h2>
          <p className="text-muted-foreground">
            You may stop using the Service at any time and may request account deletion from your
            account settings; deletion takes effect after a 30-day grace period during which you can
            change your mind. We may suspend or terminate your access to the Service, remove
            content, or cancel your account if you violate these Terms, if required by law, or if we
            discontinue the Service. If we terminate your account without cause while you have an
            active paid subscription, we will refund the unused portion of your current billing
            period. Sections of these Terms that by their nature should survive termination
            (including content licenses needed to wind down, disclaimers, and limitations of
            liability) will survive.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">13. Disclaimers</h2>
          <p className="text-muted-foreground">
            The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
            warranties of any kind, whether express or implied, including implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement. We do not
            warrant that the Service will be uninterrupted, error-free, or secure, or that AI output
            will be accurate or suitable for any purpose. Some jurisdictions do not allow certain
            warranty exclusions, so parts of this section may not apply to you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">14. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by law, InfiniStar will not be liable for any indirect,
            incidental, special, consequential, or exemplary damages — including loss of profits,
            data, goodwill, or other intangible losses — arising from or related to your use of (or
            inability to use) the Service, AI-generated output, the conduct or content of other
            users, or unauthorized access to your data. To the maximum extent permitted by law, our
            total liability for all claims relating to the Service is limited to the greater of the
            amount you paid us in the twelve months before the claim arose or one hundred US dollars
            (USD 100). Some jurisdictions do not allow certain limitations of liability, so parts of
            this section may not apply to you. Nothing in these Terms limits liability that cannot
            be limited by law.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">15. Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of [Jurisdiction], without regard to its
            conflict-of-law rules. Any disputes arising from these Terms or the Service that cannot
            be resolved informally will be subject to the exclusive jurisdiction of the courts
            located in [Jurisdiction], except where applicable law gives you the right to bring
            claims in your local courts. Before filing a claim, please contact us at
            support@infinistar.app — most concerns can be resolved quickly and informally.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">16. Changes to These Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms from time to time. When we do, we will post the updated
            version on this page and revise the &quot;Last updated&quot; date above. For material
            changes, we will provide reasonable advance notice, such as by email or an in-app
            notice. Changes take effect no earlier than the date they are posted (or the date stated
            in the notice), and your continued use of the Service after that date means you accept
            the updated Terms. If you do not agree to the changes, stop using the Service and, if
            applicable, cancel your subscription before the changes take effect.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">17. Contact Us</h2>
          <p className="text-muted-foreground">
            Questions about these Terms, or reports of violations, can be sent to
            support@infinistar.app.
          </p>
        </section>
      </div>
    </section>
  )
}
