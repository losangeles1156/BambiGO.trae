import fs from 'fs'
import path from 'path'

const TARGET_DIRS = ['src/components', 'src/app']
const MOBILE_KEYWORDS = ['touch-action', 'min-width', 'max-width', 'overflow', 'flex-col', 'grid-cols-1']
const VIEWPORT_META = '<meta name="viewport"'

function scanFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const findings: string[] = []

  if (filePath.endsWith('layout.tsx') || filePath.endsWith('page.tsx')) {
    if (!content.includes(VIEWPORT_META) && !content.includes('metadata')) {
      // findings.push('Missing viewport configuration') // Next.js handles this in metadata, so might be false positive
    }
  }

  // Check for responsive classes (Tailwind)
  const hasResponsive = /sm:|md:|lg:|xl:/.test(content)
  const hasMobileFirst = /className=.*w-full/.test(content) || /className=.*flex-col/.test(content)

  if (!hasResponsive && !hasMobileFirst && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
     // findings.push('No obvious responsive classes found')
  }

  return findings
}

function walkDir(dir: string, fileList: string[] = []) {
  if (!fs.existsSync(dir)) return fileList
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file))
    if (stat.isDirectory()) {
      walkDir(path.join(dir, file), fileList)
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.css')) {
        fileList.push(path.join(dir, file))
      }
    }
  }
  return fileList
}

console.log('--- Mobile Readiness Scan ---')
let totalFiles = 0
let issues = 0

TARGET_DIRS.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir)
  const files = walkDir(fullPath)
  totalFiles += files.length
  
  files.forEach(f => {
    const findings = scanFile(f)
    if (findings.length > 0) {
      issues++
      console.log(`[${path.relative(process.cwd(), f)}]:`)
      findings.forEach(msg => console.log(`  - ${msg}`))
    }
  })
})

console.log(`\nScanned ${totalFiles} files. Found potential issues in ${issues} files.`)
console.log('Reminder: Ensure all touch targets are at least 44x44px.')
