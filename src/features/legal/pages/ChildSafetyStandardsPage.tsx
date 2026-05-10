import styles from './ChildSafetyStandardsPage.module.css'

const LAST_UPDATED = 'May 10, 2026'

function ChildSafetyStandardsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Child safety standards">
        <h1 className={styles.heading}>Child Safety Standards</h1>
        <p className={styles.updatedAt}>Last updated: {LAST_UPDATED}</p>
        <p className={styles.intro}>
          Pawtner In Care maintains a zero-tolerance policy for child sexual abuse and exploitation
          (CSAE). Any content, behavior, or account associated with CSAE is strictly prohibited.
        </p>

        <div className={styles.content}>
          <h2>1. Zero-Tolerance Policy</h2>
          <p>
            We prohibit any content that depicts, promotes, solicits, or facilitates child sexual
            abuse or exploitation. Users may not use the platform to groom minors, share exploitative
            media, request sexual content involving minors, or coordinate harmful activity.
          </p>

          <h2>2. Detection and Moderation</h2>
          <p>
            We enforce platform rules through moderation workflows, account review, and abuse-report
            handling. Reported content may be removed immediately while investigation is ongoing.
          </p>

          <h2>3. Reporting Mechanisms</h2>
          <p>Users can report suspected CSAE through:</p>
          <ul>
            <li>In-app reporting and moderation channels where available.</li>
            <li>
              Direct email to our safety team:{' '}
              <a href="mailto:pawtnerincare@gmail.com" className={styles.link}>
                pawtnerincare@gmail.com
              </a>
            </li>
          </ul>

          <h2>4. Enforcement Actions</h2>
          <p>
            Accounts that violate this policy are subject to immediate action, including content
            removal, suspension, and permanent account termination.
          </p>

          <h2>5. Cooperation With Authorities</h2>
          <p>
            Where legally required, we cooperate with law enforcement and relevant child protection
            organizations on valid requests related to CSAE investigations.
          </p>

          <h2>6. Child Safety Point of Contact</h2>
          <p>
            For urgent child safety concerns, contact:
            <br />
            Email:{' '}
            <a href="mailto:pawtnerincare@gmail.com" className={styles.link}>
              pawtnerincare@gmail.com
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}

export default ChildSafetyStandardsPage
