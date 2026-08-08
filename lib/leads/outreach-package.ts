export interface VerifiedContactRoute {
  contactType: string;
  contactValue: string;
  label?: string | null;
  sourceUrl: string;
  verificationStatus: string;
}

const CONTACT_PRIORITY: Record<string, number> = {
  email: 0,
  website_contact_page: 1,
  linkedin: 2,
  phone: 3,
};

export function selectBestVerifiedContact(contacts: VerifiedContactRoute[]): VerifiedContactRoute | null {
  return contacts
    .filter(contact => contact.verificationStatus === "verified" && contact.sourceUrl.startsWith("https://"))
    .sort((left, right) => (CONTACT_PRIORITY[left.contactType] ?? 99) - (CONTACT_PRIORITY[right.contactType] ?? 99))[0] || null;
}

export function draftChannelForContact(contact: VerifiedContactRoute): "email" | "website" | "linkedin" | "phone" {
  if (contact.contactType === "website_contact_page") return "website";
  if (contact.contactType === "linkedin") return "linkedin";
  if (contact.contactType === "phone") return "phone";
  return "email";
}

export function contactRouteNote(contact: VerifiedContactRoute): string {
  const label = contact.label?.trim() || contact.contactType;
  return `Preferred verified route: ${label} (${contact.contactValue}). Evidence: ${contact.sourceUrl}. Review and personalize before any outreach; this package is never sent automatically.`;
}
