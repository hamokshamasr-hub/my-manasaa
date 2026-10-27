/**
 * Helper to build safe, working WhatsApp links for Egyptian and international numbers.
 * Prevents 404 Page Not Found errors on wa.me caused by malformed numbers, empty strings,
 * or extraneous characters.
 */

export function cleanPhoneNumber(raw: string | undefined | null): string {
  if (!raw) return '';
  // Remove all non-digit characters
  let digits = raw.trim().replace(/[^0-9]/g, '');
  if (!digits) return '';

  // Case 1: Egypt local mobile starting with 01 (e.g. 01012345678 -> 201012345678)
  if (digits.startsWith('01') && digits.length === 11) {
    return '2' + digits;
  }

  // Case 2: Egypt mobile without leading 0 (e.g. 1012345678 -> 201012345678)
  if (digits.startsWith('1') && digits.length === 10) {
    return '20' + digits;
  }

  // Case 3: Egypt mobile already prefixed with 20 (e.g. 201012345678)
  if (digits.startsWith('20') && digits.length === 12) {
    return digits;
  }

  // Case 4: Egypt mobile starting with 0020
  if (digits.startsWith('0020')) {
    return digits.substring(2);
  }

  // Case 5: Any other number - if it starts with 0 and has 10-11 digits, fallback to 20
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    return '2' + digits;
  }

  // If already starts with country code or international
  return digits;
}

export function buildWhatsAppUrl(rawPhone: string | undefined | null, text?: string): string {
  const cleaned = cleanPhoneNumber(rawPhone);
  if (!cleaned) return '#';

  if (text && text.trim()) {
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(text.trim())}`;
  }
  return `https://wa.me/${cleaned}`;
}
