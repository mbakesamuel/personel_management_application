import {
  memoDateHtml,
  postsThrough,
  serviceCertificateDuties,
  SERVICE_LETTER_SIGNATORY,
  type ServiceLetter,
  type ServiceLetterKind,
  type ServiceLetterPost,
} from '@personel-management-app/shared'
import { useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { ReportPreviewConsole } from './ReportPreviewConsole'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ServiceLetterPreviewProps = {
  matricule: string
  kind: ServiceLetterKind
  onClose: () => void
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function utcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day))
}

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st'
  if (day % 10 === 2 && day !== 12) return 'nd'
  if (day % 10 === 3 && day !== 13) return 'rd'
  return 'th'
}

/** "the 30th of November, 1995" with a superscript ordinal. */
function narrativeDateHtml(iso: string): string {
  const date = utcDate(iso)
  const day = date.getUTCDate()
  return `${day}<sup>${ordinalSuffix(day)}</sup> of ${MONTHS[date.getUTCMonth()]}, ${date.getUTCFullYear()}`
}

function slashDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function attachmentPhrase(letter: ServiceLetter): string {
  const place = [letter.unitName, letter.zoneName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(', ')
  const position = letter.currentPosition.trim() || 'an employee'
  return place
    ? `${letter.pronoun} is ${position} attached to the ${place}.`
    : `${letter.pronoun} is ${position}.`
}

function certificatePosts(
  letter: ServiceLetter,
  endDate: string,
): ServiceLetterPost[] {
  if (!endDate || endDate < letter.engagementDate) return []
  return postsThrough(letter.posts, endDate)
}

function buildPrintHtml(
  letter: ServiceLetter,
  issueDate: string,
  endDate: string,
  duties: string,
): string {
  const issued = memoDateHtml(utcDate(issueDate))
  const sign = escapeHtml(SERVICE_LETTER_SIGNATORY)
  const body =
    letter.kind === 'attestation'
      ? attestationBody(letter, issued)
      : certificateBody(letter, issued, endDate, duties)
  if (!body) return ''

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${letter.kind === 'attestation' ? 'Attestation of Service' : 'Certificate of Service'}</title>
  <style>
    @page { size: A4; margin: 18mm 20mm; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 14pt;
      line-height: 1.45;
      color: #000;
      margin: 0;
    }
    sup { font-size: 0.65em; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .ref { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
    .mat { margin-top: 2px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
    .whom { margin: 36px 0 0; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
    h1 { text-align: center; font-size: 16pt; text-decoration: underline; text-underline-offset: 3px; }
    h1.attest { font-style: italic; font-weight: 700; margin: 36px 0 28px; }
    h1.cert { font-weight: 700; margin: 28px 0 18px; }
    p { margin: 0 0 16px; text-align: justify; }
    .line { display: flex; gap: 16px; margin: 6px 0; }
    .label { font-weight: 700; }
    .period { display: flex; justify-content: space-between; gap: 16px; margin: 8px 0 16px; }
    .section { margin: 18px 0 8px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
    .posts-head, .post {
      display: grid;
      grid-template-columns: 1.5em 6.4em 1em 6.4em 1em minmax(0, 1.2fr) 1em minmax(0, 1.6fr);
      gap: 4px;
      align-items: baseline;
    }
    .posts-head { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; margin-bottom: 6px; }
    .post { margin: 2px 0; }
    .closing { margin-top: 28px; text-align: center; font-style: italic; }
    .sign { margin-top: 72px; text-align: center; font-weight: 700; }
  </style>
</head>
<body>
  ${body}
  <p class="sign">${sign}</p>
</body>
</html>`
}

function attestationBody(letter: ServiceLetter, issued: string): string {
  const who = [letter.courtesy, letter.fullName].filter(Boolean).join(' ')
  return `
    <div class="head">
      <div class="ref">${escapeHtml(letter.fileRef)}</div>
      <div>${issued}</div>
    </div>
    <p class="whom">TO WHOM IT MAY CONCERN</p>
    <h1 class="attest">ATTESTATION OF SERVICE</h1>
    <p>This is to attest that <strong>${escapeHtml(who)}</strong> bearer of Matriculation Number <strong>${escapeHtml(letter.matricule)}</strong> has been an Employee of the Cameroon Development Corporation from the ${narrativeDateHtml(letter.engagementDate)} till date.</p>
    <p>${escapeHtml(attachmentPhrase(letter))}</p>
    <p class="closing">This attestation has been issued to serve the purpose for which it is intended.</p>`
}

function certificateBody(
  letter: ServiceLetter,
  issued: string,
  endDate: string,
  duties: string,
): string {
  if (!endDate || endDate < letter.engagementDate) return ''
  const posts = certificatePosts(letter, endDate)
  if (posts.length === 0 || posts.some((post) => !post.to)) return ''
  const who = [letter.courtesy, letter.fullName].filter(Boolean).join(' ')
  const rows = posts
    .map(
      (post) => `<div class="post">
        <span>o</span>
        <span>${slashDate(post.from)}</span>
        <span>-</span>
        <span>${slashDate(post.to ?? '')}</span>
        <span>-</span>
        <span>${escapeHtml(post.position)}</span>
        <span>-</span>
        <span>${escapeHtml(post.location)}</span>
      </div>`,
    )
    .join('')
  return `
    <div class="head">
      <div>
        <div class="ref">${escapeHtml(letter.fileRef)}</div>
        <div class="mat">Mat. No. ${escapeHtml(letter.matricule)}</div>
      </div>
      <div>${issued}</div>
    </div>
    <h1 class="cert">CERTIFICATE OF SERVICE</h1>
    <div class="line"><span class="label">Name of Employee:</span><span>${escapeHtml(who)}</span></div>
    <div class="period">
      <span><strong>Period of Service:</strong> From: ${memoDateHtml(utcDate(letter.engagementDate))}</span>
      <span>To: ${memoDateHtml(utcDate(endDate))}</span>
    </div>
    <div class="section">NATURE AND DATES OF VARIOUS POSTS HELD:</div>
    <div class="posts-head">
      <span></span><span>From</span><span></span><span>To</span><span></span><span>Position(s)</span><span></span><span>Location</span>
    </div>
    ${rows}
    <div class="section">TYPES OF DUTIES CARRIED OUT:</div>
    <p>${escapeHtml(duties.trim())}</p>
    <p class="closing">This Certificate has been issued without any alterations or erasures.</p>`
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function ServiceLetterPreview({
  matricule,
  kind,
  onClose,
}: ServiceLetterPreviewProps) {
  const [letter, setLetter] = useState<ServiceLetter | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [issueDate, setIssueDate] = useState(todayIso)
  const [endDate, setEndDate] = useState('')
  const [duties, setDuties] = useState('')
  const [dutiesEdited, setDutiesEdited] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setLetter(null)
    setDutiesEdited(false)
    void (async () => {
      try {
        const client = await createApiClient()
        const res = await client.personnel.employees[':matricule'][
          'service-letter'
        ].$get({
          param: { matricule },
          query: { kind },
        })
        if (!res.ok) {
          throw new Error(await readError(res, 'Failed to prepare the letter'))
        }
        const body = (await res.json()) as ServiceLetter
        if (cancelled) return
        setLetter(body)
        setEndDate(body.endDate ?? '')
        setDuties(body.duties)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind, matricule])

  const printedPosts = useMemo(() => {
    if (!letter || letter.kind !== 'certificate' || !endDate) return []
    return certificatePosts(letter, endDate)
  }, [endDate, letter])

  useEffect(() => {
    if (!letter || letter.kind !== 'certificate' || dutiesEdited) return
    const posts = endDate ? printedPosts : letter.posts
    if (posts.length === 0) return
    setDuties(
      serviceCertificateDuties({
        courtesy: letter.courtesy,
        fullName: letter.fullName,
        posts,
      }),
    )
  }, [dutiesEdited, endDate, letter, printedPosts])

  const endError =
    letter?.kind === 'certificate' && !loading
      ? !endDate
        ? 'Enter the date service ended before printing.'
        : endDate < letter.engagementDate
          ? 'The end date is before the engagement date.'
          : printedPosts.length === 0
            ? 'The end date is before every recorded post.'
            : null
      : null

  const printHtml = useMemo(() => {
    if (!letter || !issueDate || endError) return ''
    return buildPrintHtml(letter, issueDate, endDate, duties)
  }, [duties, endDate, endError, issueDate, letter])

  const title =
    kind === 'attestation' ? 'Attestation of Service' : 'Certificate of Service'

  return (
    <ReportPreviewConsole
      title={title}
      onClose={onClose}
      status={loadError ?? endError}
      loading={loading}
      hasData={printHtml.length > 0}
      printHtml={printHtml}
      defaultPdfName={`${kind}-of-service-${matricule}.pdf`}
      emptyMessage={
        loadError
          ? 'The letter could not be prepared.'
          : 'Choose the dates above to preview the letter.'
      }
      toolbar={
        <Card className="shrink-0 py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-3">
            <div className="grid gap-1">
              <Label htmlFor="service-letter-issued">Issue date</Label>
              <Input
                id="service-letter-issued"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </div>
            {kind === 'certificate' ? (
              <>
                <div className="grid gap-1">
                  <Label htmlFor="service-letter-end">Service ended</Label>
                  <Input
                    id="service-letter-end"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
                <div className="grid min-w-72 flex-1 gap-1">
                  <Label htmlFor="service-letter-duties">Duties</Label>
                  <Textarea
                    id="service-letter-duties"
                    rows={3}
                    value={duties}
                    onChange={(event) => {
                      setDutiesEdited(true)
                      setDuties(event.target.value)
                    }}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      }
    />
  )
}
