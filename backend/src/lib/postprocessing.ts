const EXPECTED_SECTIONS = ['Wins', 'In Progress', 'Risks / Blockers', 'Scope Changes'] as const
const MAX_BULLETS = 5

export function postprocessContent(markdown: string): string {
  const sectionMap = new Map<string, string[]>()
  let currentSection: string | null = null

  for (const line of markdown.split('\n')) {
    const sectionMatch = line.match(/^###\s+(.+)/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      if (!sectionMap.has(currentSection)) sectionMap.set(currentSection, [])
    } else if (currentSection && line.trim().startsWith('-')) {
      const bullets = sectionMap.get(currentSection)!
      if (bullets.length < MAX_BULLETS) bullets.push(line.trim())
    }
  }

  const parts = ['## Weekly Update', '']
  for (const section of EXPECTED_SECTIONS) {
    const bullets = sectionMap.get(section) ?? []
    parts.push(`### ${section}`)
    parts.push(...(bullets.length > 0 ? bullets : ['- Nothing to report.']))
    parts.push('')
  }

  return parts.join('\n').trimEnd()
}
