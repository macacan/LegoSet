// Priser i vald valuta.
// Brickset har listpriser från LEGO.com i USA, Storbritannien, Kanada och Tyskland.
// Väljer man USD/GBP/CAD/EUR visas det riktiga listpriset i den valutan.
// Andra valutor (t.ex. SEK) räknas om från det tyska europriset med dagens
// ECB-kurs och märks med "≈", eftersom LEGO:s svenska pris kan skilja sig.

export const CURRENCIES = [
  { code: 'SEK', label: 'Svenska kronor (kr)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'US-dollar ($)' },
  { code: 'GBP', label: 'Brittiska pund (£)' },
  { code: 'NOK', label: 'Norska kronor (kr)' },
  { code: 'DKK', label: 'Danska kronor (kr)' },
  { code: 'CAD', label: 'Kanadensiska dollar ($)' },
];

const NATIVE = { EUR: 'DE', GBP: 'UK', USD: 'US', CAD: 'CA' };
const REGION_CURRENCY = { DE: 'EUR', UK: 'GBP', US: 'USD', CA: 'CAD' };

const formatters = new Map();
function fmt(amount, currency) {
  if (!formatters.has(currency)) {
    const whole = ['SEK', 'NOK', 'DKK'].includes(currency);
    formatters.set(
      currency,
      new Intl.NumberFormat('sv-SE', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 }),
    );
  }
  return formatters.get(currency).format(amount);
}

// Returnerar { amount, text, exact } eller null.
export function priceIn(prices = {}, currency, fx) {
  const native = NATIVE[currency];
  if (native && prices[native]) return { amount: prices[native], text: fmt(prices[native], currency), exact: true };

  const rates = fx?.rates;
  if (!rates?.[currency]) return null;
  for (const region of ['DE', 'US', 'UK', 'CA']) {
    const value = prices[region];
    const from = REGION_CURRENCY[region];
    if (value && rates[from]) {
      const amount = (value / rates[from]) * rates[currency];
      return { amount, text: `≈ ${fmt(amount, currency)}`, exact: false };
    }
  }
  return null;
}
