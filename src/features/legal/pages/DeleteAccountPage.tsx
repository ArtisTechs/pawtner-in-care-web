import { Link } from 'react-router-dom'
import titleLogo from '@/assets/title-logo.png'
import { APP_ROUTES } from '@/app/routes/route-paths'
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
        <a href="mailto:thepawtnerincare@gmail.com" className={styles.email}>
          thepawtnerincare@gmail.com
        </a>
        <p className={styles.note}>
          Include your registered email and account details so we can process your request.
        </p>
        <Link to={APP_ROUTES.login} className={styles.backLink}>
          Back to Login
        </Link>
      </section>
    </main>
  )
}

export default DeleteAccountPage
