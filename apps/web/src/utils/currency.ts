export interface FormatCurrencyOptions {
  fallback?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const ensureNumber = (value: unknown, defaultValue = 0): number => {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
};

export const ensurePositiveInteger = (value: unknown, defaultValue = 1): number => {
  const parsed = Math.floor(ensureNumber(value, defaultValue));
  return parsed > 0 ? parsed : defaultValue;
};

export const formatCurrency = (
  value: unknown,
  options: FormatCurrencyOptions = {}
): string => {
  const { fallback = '0', locale = 'zh-TW', minimumFractionDigits, maximumFractionDigits } = options;
  const amount = ensureNumber(value, Number.NaN);

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  const hasExplicitDigits =
    minimumFractionDigits !== undefined || maximumFractionDigits !== undefined;

  return amount.toLocaleString(
    locale,
    hasExplicitDigits
      ? {
          minimumFractionDigits,
          maximumFractionDigits
        }
      : undefined
  );
};
