/** Bilingual labels for group IOU direction. Do not rephrase without a wording pass. */
export const OWES_EN_UR = "Owes / Denay Hain";
export const OWED_EN_UR = "Owed / Lenay Hain";

export function owesToLine(
  who: string,
  amountLabel: string,
  toName: string,
): string {
  return `${who} ${OWES_EN_UR} ${amountLabel} to ${toName}`;
}

export function owedFromLine(
  who: string,
  amountLabel: string,
  fromName: string,
): string {
  return `${who} ${OWED_EN_UR} ${amountLabel} from ${fromName}`;
}

export function owesAmountLine(who: string, amountLabel: string): string {
  return `${who} ${OWES_EN_UR} ${amountLabel}`;
}

export function owedAmountLine(who: string, amountLabel: string): string {
  return `${who} ${OWED_EN_UR} ${amountLabel}`;
}
