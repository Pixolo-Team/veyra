/**
 * What each icon *means* in this app, mapped onto the shared set.
 *
 * The glyphs themselves live in `@veyra/design-system` — this file is only the
 * naming layer, so a screen asks for `DossierIcon` rather than picking a folder
 * shape, and changing which folder shape that is stays a one-line edit here.
 *
 * The design system's `IconProps` carries the sizing contract: 16px by default,
 * `currentColor` throughout, so an icon follows the text beside it.
 */

import { ChevronRightIcon, type IconProps } from '@veyra/design-system';

export type { IconProps };

export {
  /* Navigation & chrome */
  LayoutGridIcon as OverviewIcon,
  FolderIcon as DossierIcon,
  FileIcon as DocumentsIcon,
  UsersIcon as GroupsIcon,
  HistoryIcon as ActivityIcon,
  HistoryIcon as ReopenIcon,
  CogIcon as SettingsIcon,
  LogOutIcon,
  BellIcon,
  SearchIcon,
  TransferVerticalIcon as SwitchRoomIcon,
  SidebarCollapseIcon as CollapseRailIcon,
  SidebarExpandIcon as ExpandRailIcon,

  /* Actions */
  PlusIcon,
  UploadIcon,
  FileUploadIcon,
  DeleteIcon,
  FolderAddIcon as NewFolderIcon,
  FileAddIcon as NewFileIcon,
  ExpandContentIcon as ExpandAllIcon,
  CollapseContentIcon as CollapseAllIcon,
  PencilIcon as RenameIcon,
  MoreIcon,
  CloseIcon,

  /* State & content */
  CheckIcon,
  CheckCircleIcon,
  CheckDoubleIcon as ResolveIcon,
  CommentIcon,
  CommentIcon as ReplyIcon,
  EyeIcon,
  HighlighterIcon,
  ShieldCheckIcon as ShieldIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,

  /* File types — see FileTypeIcon, which picks between them */
  FilePdfIcon,
  FileDocIcon,
  FileXlsIcon,
  FilePptIcon,
  FileTxtIcon,
  FileZipIcon,
  FileJpgIcon,
  FileCodeIcon,
} from '@veyra/design-system';

/**
 * The set ships one chevron. A separate down-facing glyph would be the same
 * path drawn again at a different angle, so this turns the one there is —
 * which also guarantees the two stay identical in weight.
 */
export function ChevronDownIcon({ style, ...rest }: IconProps) {
  return <ChevronRightIcon {...rest} style={{ transform: 'rotate(90deg)', ...style }} />;
}

/** Same glyph turned the other way — the way back out of a flow. */
export function ChevronLeftIcon({ style, ...rest }: IconProps) {
  return <ChevronRightIcon {...rest} style={{ transform: 'rotate(180deg)', ...style }} />;
}
