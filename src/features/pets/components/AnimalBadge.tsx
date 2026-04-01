import catAnimalIcon from '@/assets/cat-icon.png'
import dogAnimalIcon from '@/assets/dog-icon.png'
import type { AnimalType } from '@/features/pets/utils/pet-form'
import styles from '@/features/pets/pages/PetListPage.module.css'

interface AnimalBadgeProps {
  animal: AnimalType
}

function AnimalBadge({ animal }: AnimalBadgeProps) {
  const animalIconSrc = animal === 'cat' ? catAnimalIcon : dogAnimalIcon

  return (
    <button type="button" className={styles.animalBadge} aria-label={`Mark as ${animal}`}>
      <img src={animalIconSrc} alt="" className={styles.animalBadgeIcon} />
    </button>
  )
}

export default AnimalBadge
