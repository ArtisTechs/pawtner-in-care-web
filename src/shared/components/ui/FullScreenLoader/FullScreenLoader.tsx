import type { CSSProperties } from 'react'
import loadingText from '@/assets/loading-text.png'
import logoTransparent from '@/assets/logo-transparent.png'
import styles from './FullScreenLoader.module.css'

interface FullScreenLoaderProps {
  backgroundColor?: string
  subtitle?: string
  visible?: boolean
}

function FullScreenLoader({
  backgroundColor,
  subtitle = 'Please wait while we load everything for you.',
  visible = true,
}: FullScreenLoaderProps) {
  if (!visible) {
    return null
  }

  return (
    <div className={styles.overlay} style={{ '--loader-background': backgroundColor } as CSSProperties}>
      <div className={styles.content}>
        <div className={styles.centerWrap}>
          <div className={styles.logoCircle}>
            <div className={styles.ringTrack} />
            <div className={styles.ringArc} />
            <img src={logoTransparent} alt="" aria-hidden="true" className={styles.logo} />
          </div>
        </div>

        <img src={loadingText} alt="" aria-hidden="true" className={styles.loadingTextImage} />
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>
  )
}

export default FullScreenLoader
