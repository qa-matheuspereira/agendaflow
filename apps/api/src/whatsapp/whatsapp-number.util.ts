// Brazilian numbers: Evolution API may omit the 9th digit for older numbers.
// If lookup with bare number fails, try adding/removing the 9th digit.
export function brazilianAlternate(number: string): string | null {
  // 55 + DDD (2 digits) + number
  if (!number.startsWith('55') || number.length < 12) return null;
  const ddd = number.slice(2, 4);
  const local = number.slice(4);
  if (local.length === 9 && local.startsWith('9')) {
    // 13-digit → try 12-digit (remove the leading 9)
    return `55${ddd}${local.slice(1)}`;
  }
  if (local.length === 8) {
    // 12-digit → try 13-digit (add leading 9)
    return `55${ddd}9${local}`;
  }
  return null;
}
