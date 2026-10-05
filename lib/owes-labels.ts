/** Bilingual labels for group IOU direction. Do not rephrase without a wording pass. */
export const OWES_EN_UR = "Owes / Denay Hain";
export const OWED_EN_UR = "Owed / Lenay Hain";
export const YOU_OWE_EN_UR = "You owe / Denay Hain";
export const YOU_GET_EN_UR = "You get / Lenay Hain";
export const SETTLED_UP = "You're settled up";
export const PENDING_ON_THE_WAY = "on the way (pending)";
export const FEWEST_PAYMENTS_LABEL = "Fewest payments";
export const DIRECT_LABEL = "Direct";
export const FEWEST_VS_DIRECT_HELP =
  '"Fewest payments" combines everyone\'s balances so the group needs as few transfers as possible — you may be asked to pay someone you didn\'t share a bill with directly. "Direct" shows exactly who paid for you.';

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
