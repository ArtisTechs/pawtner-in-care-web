import { copyFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve('dist')
const indexPath = path.join(distDir, 'index.html')
const notFoundPath = path.join(distDir, '404.html')
const noJekyllPath = path.join(distDir, '.nojekyll')

try {
  await stat(indexPath)
} catch {
  throw new Error('dist/index.html was not found. Run the Vite build before preparing GitHub Pages.')
}

await copyFile(indexPath, notFoundPath)
await writeFile(noJekyllPath, '')

console.log('Prepared GitHub Pages files: dist/404.html and dist/.nojekyll')
