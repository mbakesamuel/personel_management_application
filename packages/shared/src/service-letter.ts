export const SERVICE_LETTER_FILE_REF = 'DHR/ST/5'
export const SERVICE_LETTER_SIGNATORY = 'DIRECTOR, HUMAN RESOURCES'

export type ServiceLetterKind = 'attestation' | 'certificate'

export type ServiceLetterPost = {
  from: string
  to: string | null
  position: string
  location: string
}

export type ServiceMovement = {
  date: string
  position: string
  location: string
}

export type ServiceLetter = {
  kind: ServiceLetterKind
  fileRef: string
  matricule: string
  fullName: string
  courtesy: string
  pronoun: string
  engagementDate: string
  currentPosition: string
  unitName: string | null
  zoneName: string | null
  endDate: string | null
  posts: ServiceLetterPost[]
  duties: string
}

export function addIsoDays(iso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) throw new Error(`Invalid date ${iso}`)
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function filled(value: string, fallback: string): string {
  const text = value.trim()
  return text || fallback
}

/** Posts from engagement through each movement. The last post ends on endDate. */
export function buildServicePosts(input: {
  engagementDate: string
  job: string
  place: string
  movements: ServiceMovement[]
  endDate: string | null
}): ServiceLetterPost[] {
  const job = filled(input.job, 'Employee')
  const place = filled(input.place, 'Corporation')
  const moves = input.movements
    .filter((row) => row.date >= input.engagementDate)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  const points: { from: string; position: string; location: string }[] = []
  const opening = moves.filter((row) => row.date === input.engagementDate)
  const later = moves.filter((row) => row.date > input.engagementDate)
  const sameDay = opening[opening.length - 1]
  points.push({
    from: input.engagementDate,
    position: filled(sameDay?.position ?? '', job),
    location: filled(sameDay?.location ?? '', place),
  })

  for (const move of later) {
    const prev = points[points.length - 1]
    if (!prev) continue
    if (move.date === prev.from) {
      prev.position = filled(move.position, prev.position)
      prev.location = filled(move.location, prev.location)
      continue
    }
    points.push({
      from: move.date,
      position: filled(move.position, prev.position),
      location: filled(move.location, prev.location),
    })
  }

  return points
    .map((point, index) => {
      const next = points[index + 1]
      const to = next ? addIsoDays(next.from, -1) : input.endDate
      return {
        from: point.from,
        to,
        position: point.position,
        location: point.location,
      }
    })
    .filter((post) => post.to == null || post.to >= post.from)
}

/** Keep posts that start on or before endDate, and close the last one on that date. */
export function postsThrough(
  posts: ServiceLetterPost[],
  endDate: string,
): ServiceLetterPost[] {
  const kept = posts.filter((post) => post.from <= endDate)
  if (kept.length === 0) return []
  return kept.map((post, index) =>
    index === kept.length - 1 ? { ...post, to: endDate } : post,
  )
}

export function serviceCertificateDuties(input: {
  courtesy: string
  fullName: string
  posts: { position: string; location: string }[]
}): string {
  const first = input.posts[0]
  const last = input.posts[input.posts.length - 1]
  if (!first || !last) return ''
  const who = [input.courtesy.trim(), input.fullName.trim()]
    .filter(Boolean)
    .join(' ')
  return `${who} was employed in the ${first.location} as ${first.position} and left the Corporation as ${last.position} in ${last.location}.`
}
