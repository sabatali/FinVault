const MAX_AMOUNT = 1e12;

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

/** Round to 2 decimal places (half-up). All PKR amounts use this helper. */
export function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function assertFiniteAmount(
  value: number,
  fieldName = "amount",
): number {
  if (!Number.isFinite(value)) {
    throw new InvalidAmountError(`${fieldName} must be a finite number`);
  }

  const rounded = roundAmount(value);

  if (Math.abs(rounded) > MAX_AMOUNT) {
    throw new InvalidAmountError(
      `${fieldName} must be between -${MAX_AMOUNT} and ${MAX_AMOUNT}`,
    );
  }

  return rounded;
}

export const MONEY_MAX = MAX_AMOUNT;
