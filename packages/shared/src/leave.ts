export function isAnnualLeaveTypeName(name: string | null | undefined): boolean {
  return name?.trim().toLowerCase() === 'annual leave'
}

export function isAnnualLeaveType(
  type: { name?: string | null; deductBalance?: boolean | null } | null | undefined,
): boolean {
  return Boolean(type?.deductBalance) || isAnnualLeaveTypeName(type?.name)
}

export type LeaveMemoKind = 'ANNUAL_LEAVE' | 'PERMISSION'

const LEAVE_MEMO_FILE_REFS: Record<
  LeaveMemoKind,
  readonly { min: number; max: number; ref: string }[]
> = {
  ANNUAL_LEAVE: [
    { min: 1, max: 6, ref: 'DHR/V/DP' },
    { min: 7, max: 8, ref: 'IS/302' },
    { min: 9, max: 12, ref: 'STF/2019' },
  ],
  PERMISSION: [
    { min: 1, max: 6, ref: 'DHR/V/DP' },
    { min: 7, max: 8, ref: 'IS/213' },
    { min: 9, max: 12, ref: 'STF/1618' },
  ],
}

export function leaveMemoFileRef(
  kind: LeaveMemoKind,
  category: number,
): string | null {
  const band = LEAVE_MEMO_FILE_REFS[kind].find(
    (row) => category >= row.min && category <= row.max,
  )
  return band?.ref ?? null
}
