export function contactHref(contactType: string, contactValue: string): string | null {
  const value = contactValue.trim();
  if (!value) return null;

  if (contactType === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
  }

  if (contactType === "phone") {
    const phone = value.replace(/[^\d+]/g, "");
    return phone.length >= 7 ? `tel:${phone}` : null;
  }

  if (contactType === "website_contact_page" || contactType === "linkedin") {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  return null;
}
