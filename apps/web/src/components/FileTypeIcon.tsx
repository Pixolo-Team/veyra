import { useVeyraTokens } from '@veyra/design-system';
import {
  FileCodeIcon,
  FileDocIcon,
  FileIcon,
  FileJpgIcon,
  FilePdfIcon,
  FilePptIcon,
  FileTxtIcon,
  FileXlsIcon,
  FileZipIcon,
  type IconProps,
} from './icons';

type Role = 'pdf' | 'doc' | 'sheet' | 'slides' | 'text' | 'archive' | 'image' | 'code' | 'other';

/**
 * Extension first, MIME second.
 *
 * The extension is what the person named the file and what they see in the
 * row, so it's the answer they expect. MIME is the fallback for the cases
 * where there's no extension to read, and it's less trustworthy than it looks:
 * a browser will happily hand over `application/octet-stream` for a perfectly
 * ordinary .docx.
 */
const BY_EXTENSION: Record<string, Role> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  rtf: 'doc',
  odt: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ods: 'sheet',
  ppt: 'slides',
  pptx: 'slides',
  odp: 'slides',
  txt: 'text',
  md: 'text',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  gz: 'archive',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  json: 'code',
  xml: 'code',
  xls_: 'sheet',
};

const BY_MIME: [test: RegExp, role: Role][] = [
  [/pdf/, 'pdf'],
  [/wordprocessing|msword/, 'doc'],
  [/spreadsheet|ms-?excel|csv/, 'sheet'],
  [/presentation|ms-?powerpoint/, 'slides'],
  [/zip|compressed|tar/, 'archive'],
  [/^image\//, 'image'],
  [/json|xml/, 'code'],
  [/^text\//, 'text'],
];

const GLYPH: Record<Role, (p: IconProps) => React.ReactElement> = {
  pdf: FilePdfIcon,
  doc: FileDocIcon,
  sheet: FileXlsIcon,
  slides: FilePptIcon,
  text: FileTxtIcon,
  archive: FileZipIcon,
  image: FileJpgIcon,
  code: FileCodeIcon,
  other: FileIcon,
};

function roleFor(name: string, mimeType?: string): Role {
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (BY_EXTENSION[extension]) return BY_EXTENSION[extension];
  if (mimeType) {
    const match = BY_MIME.find(([test]) => test.test(mimeType.toLowerCase()));
    if (match) return match[1];
  }
  return 'other';
}

/**
 * A document's icon, coloured by what kind of document it is.
 *
 * Colour is the point: a dossier row is mostly filename, and one glance down a
 * column of red should say "these are the PDFs" before anything is read. The
 * hues come from the status roles rather than the brands' own — Acrobat red,
 * Excel green — because a palette that borrows five vendors' colours stops
 * being a palette, and these already carry the contrast guarantees.
 *
 * Everything unrecognised falls back to a plain page in the surrounding ink,
 * so an unknown type reads as "a file" rather than as a type we got wrong.
 */
export function FileTypeIcon({
  name,
  mimeType,
  ...props
}: IconProps & { name: string; mimeType?: string }) {
  const { colors } = useVeyraTokens();
  const role = roleFor(name, mimeType);
  const Glyph = GLYPH[role];

  const color: Record<Role, string | undefined> = {
    pdf: colors.danger,
    doc: colors.info,
    sheet: colors.success,
    slides: colors.warning,
    text: colors.textTertiary,
    archive: colors.textTertiary,
    image: colors.brand,
    code: colors.textTertiary,
    other: undefined, // inherit — see the note above
  };

  return <Glyph {...props} style={{ color: color[role], ...props.style }} />;
}
