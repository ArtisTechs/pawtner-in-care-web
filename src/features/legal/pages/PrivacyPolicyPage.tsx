import { Link } from 'react-router-dom'
import titleLogo from '@/assets/title-logo.png'
import { APP_ROUTES } from '@/app/routes/route-paths'
import styles from './PrivacyPolicyPage.module.css'

const LAST_UPDATED = 'May 8, 2026'

function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Privacy Policy">
        <header className={styles.header}>
          <img src={titleLogo} alt="Pawtner In Care" className={styles.logo} />
          <h1 className={styles.heading}>Privacy Policy</h1>
          <p className={styles.updatedAt}>Last updated: {LAST_UPDATED}</p>
          <p className={styles.intro}>
            This Privacy Policy explains how Pawtner In Care collects, uses, stores, and shares
            personal information when you use the Pawtner In Care mobile application and related
            services.
          </p>
        </header>

        <div className={styles.content}>
          <h2>1. Scope</h2>
          <p>
            This policy applies to the Pawtner In Care mobile application distributed through
            Google Play and any connected backend services, including account, rescue reporting,
            community, chat, notifications, donation, and related platform features.
          </p>

          <h2>2. Information We Collect</h2>
          <ul>
            <li>
              Account and profile data: name, email address, role, shelter details, and
              authentication records (such as OTP verification flow and login session metadata).
            </li>
            <li>
              User-generated content: post text, chat messages, SOS details, photos, videos, and
              other media uploaded through app features.
            </li>
            <li>
              Location data: latitude/longitude and address information you provide or allow during
              SOS reporting and nearby veterinary/rescue-related functions.
            </li>
            <li>
              Donation and transaction-related records: selected payment method and proof of payment
              media uploaded for validation and history.
            </li>
            <li>
              Technical and usage data: app activity events, device/network information needed for
              session management, security, reliability, and feature operation.
            </li>
          </ul>

          <h2>3. Why We Use Your Information</h2>
          <ul>
            <li>To create and manage your account and authenticate access.</li>
            <li>To deliver core features such as SOS coordination, chat, posting, and donations.</li>
            <li>To send in-app and push notifications about account and platform activity.</li>
            <li>To moderate safety-related reports and improve service quality and security.</li>
            <li>To comply with legal obligations and enforce platform rules.</li>
          </ul>

          <h2>4. App Permissions (Google Play)</h2>
          <p>
            Depending on your device and Android version, Pawtner In Care may request permissions
            including location, camera, media/photo access, internet/network, notifications, and
            vibration. These are used to support SOS reporting, media uploads, chat/community
            content, and timely alerts. You can manage most permissions in your device settings.
          </p>

          <h2>5. Third-Party Services and Data Sharing</h2>
          <p>
            Pawtner In Care uses service providers to run the platform, such as cloud media storage
            and backend APIs. Information is shared only as necessary to operate features, maintain
            security, and provide support. We do not sell personal data.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We retain data only for as long as needed to provide services, resolve disputes, prevent
            abuse, meet legal obligations, and maintain essential records. Retention periods may vary
            by data type and legal requirement.
          </p>

          <h2>7. Security</h2>
          <p>
            We apply reasonable administrative, technical, and organizational safeguards to protect
            your information. No method of transmission or storage is fully secure, but we work to
            reduce risk and respond to incidents appropriately.
          </p>

          <h2>8. Children&apos;s Privacy</h2>
          <p>
            Pawtner In Care is not intended for children under 13. We do not knowingly collect
            personal information directly from children under 13.
          </p>

          <h2>9. Your Rights and Choices</h2>
          <ul>
            <li>You may review or update certain profile data in the app.</li>
            <li>You may control permission grants from your device settings.</li>
            <li>
              You may request account or data-related support by contacting us through the details
              below.
            </li>
          </ul>

          <h2>10. International Processing</h2>
          <p>
            Your information may be processed or stored in locations where we or our providers
            operate. We take steps to protect data consistent with applicable laws.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes are effective when posted
            on this page, and material changes may be highlighted in-app when appropriate.
          </p>

          <h2>12. Contact</h2>
          <p>
            For privacy questions or requests, contact the Pawtner In Care team at:
            <br />
            <span className={styles.contact}>pawtnerincare@gmail.com</span>
          </p>

          <h2>13. Google Play Privacy Policy Statement</h2>
          <p>
            This page is the official Privacy Policy URL for the Pawtner In Care Android app listed
            on Google Play. It describes data handling for Google Play review and user transparency
            requirements.
          </p>
        </div>

        <footer className={styles.footer}>
          <Link to={APP_ROUTES.login} className={styles.backLink}>
            Back to Login
          </Link>
        </footer>
      </section>
    </main>
  )
}

export default PrivacyPolicyPage
