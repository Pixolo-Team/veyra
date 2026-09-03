/**
 * NDA text, keyed by the version string a room stores in `rooms.nda_version`.
 *
 * The server records *which version* a participant accepted, not the text — so
 * a version's wording must never change once it has been accepted by anyone.
 * Add `v2` beside `v1` instead of editing `v1`.
 *
 * TODO(api): this belongs behind an endpoint so an acceptance stays reproducible
 * from the server alone. Until then, treat this file as append-only.
 */
export const NDA_TEXTS: Record<string, { title: string; paragraphs: string[] }> = {
  v1: {
    title: 'Mutual Non-Disclosure Agreement',
    paragraphs: [
      'The Recipient agrees that all information disclosed through this data room, including regulatory, clinical and manufacturing documentation, is confidential and is provided solely for the purpose of evaluating a potential transaction.',
      'The Recipient shall not disclose any such information to a third party, and shall limit access within its own organisation to those individuals who need it for that evaluation and who are bound by obligations no less protective than these.',
      'The Recipient acknowledges that access to each document, including the identity of the reader and the time spent, is logged and is visible to the Disclosing Party.',
      'These obligations survive for five years from the date of acceptance, or until the information enters the public domain other than through the Recipient’s act or omission.',
    ],
  },
};

export function ndaText(version: string | null | undefined) {
  return (version && NDA_TEXTS[version]) || NDA_TEXTS.v1;
}
