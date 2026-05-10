import titleLogo from '@/assets/title-logo.png'
import styles from './DeleteAccountPage.module.css'

function DeleteAccountPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Delete Account">
        <img src={titleLogo} alt="Pawtner In Care" className={styles.logo} />
        <h1 className={styles.heading}>Delete Account Request</h1>
        <p className={styles.message}>
          To request account and associated data deletion, please email:
        </p>
        <a href="mailto:pawtnerincare@gmail.com" className={styles.email}>
          pawtnerincare@gmail.com
        </a>
        <p className={styles.note}>
          Include your registered email and account details so we can process your request.
        </p>
      </section>
    </main>
  )
}

export default DeleteAccountPage
