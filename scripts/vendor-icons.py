"""
Vendors the icons the app actually uses out of the Neevo set.

The source components can't be used as they ship: they import a type from
`@/types/icon`, hardcode a 28px box, and paint from a `primaryColor` prop with
no default — so an icon dropped in as-is renders black in dark mode. This
rewrites all three into one `size` prop and `currentColor` throughout.

Only the listed icons are copied. The full set is ~5,000 components; vendoring
it whole would put an unreviewed megabyte of generated SVG in the repo to use
two dozen of them.

    python3 scripts/vendor-icons.py [path-to-neevo-icons]
"""

import pathlib, re, sys

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '~/Downloads/neevo-icons').expanduser()
OUT = pathlib.Path(__file__).resolve().parent.parent / 'packages/design-system/src/icons/generated.tsx'

# neevo file -> the name we export it under
PICK = [
    ('LayoutGrid', 'LayoutGridIcon'),
    ('FileFolder', 'FolderIcon'),
    ('OpenFolder', 'FolderOpenIcon'),
    ('FolderAdd', 'FolderAddIcon'),
    ('FileReport', 'FileIcon'),
    ('FileAdd', 'FileAddIcon'),
    ('UserMultipleGroup', 'UsersIcon'),
    ('TimeLapse', 'HistoryIcon'),
    ('Cog', 'CogIcon'),
    ('Logout1', 'LogOutIcon'),
    ('BellNotification', 'BellIcon'),
    ('MagnifyingGlass', 'SearchIcon'),
    ('Add1', 'PlusIcon'),
    ('UploadTray', 'UploadIcon'),
    ('FileDocumentUploadPublish', 'FileUploadIcon'),
    ('DeleteSweepTrash', 'DeleteIcon'),
    ('ArrowsChevronsExpandContent', 'ExpandContentIcon'),
    ('ArrowsChevronsCollapseContent', 'CollapseContentIcon'),
    ('Check', 'CheckIcon'),
    ('CheckCircle', 'CheckCircleIcon'),
    ('ShieldCheck', 'ShieldCheckIcon'),
    ('SidebarCollapses', 'SidebarCollapseIcon'),
    ('SidebarExpand', 'SidebarExpandIcon'),
    ('LineArrowTransferVertical1', 'TransferVerticalIcon'),
    ('ChevronRight', 'ChevronRightIcon'),
    ('Pencil', 'PencilIcon'),
    ('HorizontalMenu', 'MoreIcon'),
    ('Close', 'CloseIcon'),
    ('CheckDoubleReadDoneAll', 'CheckDoubleIcon'),
    ('ChatBubbleTextOval', 'CommentIcon'),
    ('EyeOptic', 'EyeIcon'),
    ('Highlighter', 'HighlighterIcon'),

    # File types. Each is a page with its format lettered on it, so a row says
    # what it is before you read the extension.
    ('FilePdf', 'FilePdfIcon'),
    ('FileDoc', 'FileDocIcon'),
    ('FileXls', 'FileXlsIcon'),
    ('FilePpt', 'FilePptIcon'),
    ('FileTxt', 'FileTxtIcon'),
    ('FileZip', 'FileZipIcon'),
    ('FileJpg', 'FileJpgIcon'),
    ('FileCode1', 'FileCodeIcon'),
    ('Sun', 'SunIcon'),
    ('AngledMoon', 'MoonIcon'),
    ('Monitor', 'MonitorIcon'),
]

HEADER = '''/* eslint-disable */
/**
 * GENERATED — do not edit by hand.
 *
 * Vendored from the Neevo icon set. The source components are written for a
 * different project: they import a type from `@/types/icon`, hardcode a 28px
 * box, and paint from a `primaryColor` prop that has no default (so an icon
 * dropped in as-is renders black in dark mode). This file normalises all three
 * — one `size` prop, `currentColor` throughout, no foreign imports — so the
 * icons behave like text and theme for free.
 *
 * To add one: add its neevo name to `scripts/vendor-icons.py` and re-run it.
 */

import type { SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /**
   * Edge length in px. 16 sits level with antd's 14px body text; standalone
   * chrome (the sidebar rail) asks for more.
   * @default 16
   */
  size?: number;
  /**
   * Overrides the stroke weight of every stroked path. The set is drawn for a
   * 28px box, so an icon shrunk to 14 carries a proportionally heavier line —
   * this is the lever for pulling it back. Leave unset to keep the original.
   */
  strokeWidth?: number;
}
'''

STROKED = re.compile(r'(<(?:path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*?)strokeWidth=\{([\d.]+)\}', re.S)


def overridable_strokes(body: str) -> str:
    """Make the weight of genuinely stroked shapes a prop.

    Only shapes that actually paint a stroke: the fill-based icons carry a
    hairline `strokeWidth` that is part of how the shape is drawn, and letting
    a caller widen that would thicken the glyph itself.
    """
    def sub(m: 're.Match[str]') -> str:
        head, width = m.group(1), m.group(2)
        if 'stroke="currentColor"' not in head:
            return m.group(0)
        return f'{head}strokeWidth={{strokeWidth ?? {width}}}'

    return STROKED.sub(sub, body)


def convert(name: str, export: str) -> str:
    text = (SRC / f'{name}.tsx').read_text()
    start = text.index('<svg')
    end = text.index('</svg>') + len('</svg>')
    svg = text[start:end]

    open_end = svg.index('>')
    tag, body = svg[:open_end], svg[open_end:]

    # Most of the set is drawn in a square box, but not all — the thin chevron
    # lives in a 7x11 one. Sizing both axes to `size` would squash it, so the
    # box's own ratio decides the width and `size` always means height.
    vb = [float(n) for n in re.search(r'viewBox="([^"]*)"', tag).group(1).split()]
    ratio = vb[2] / vb[3]
    width = 'size' if abs(ratio - 1) < 0.01 else 'size * %s' % round(ratio, 4)

    # The wrapper owns the box and the spread, so drop the source's versions.
    tag = re.sub(r'\s(?:width|height)=(?:\{\d+\}|"[^"]*")', '', tag)
    tag = tag.replace('{...props}', '')
    tag = '\n'.join(line for line in tag.split('\n') if line.strip())

    svg = f'{tag}\n    width={{{width}}}\n    height={{size}}\n    {{...rest}}\n  {body}'
    # Every paint follows the surrounding text instead of a prop with no default.
    svg = svg.replace('{primaryColor}', '"currentColor"')
    svg = svg.replace('{secondaryColor}', '"currentColor"')
    svg = svg.replace('{tertiaryColor}', '"currentColor"')

    svg = overridable_strokes(svg)
    svg = '\n'.join(line[2:] if line.startswith('  ') else line for line in svg.split('\n'))
    return (
        f'export const {export} = ({{ size = 16, strokeWidth, ...rest }}: IconProps) => (\n'
        f'{svg}\n);\n'
    )

parts = [HEADER]
for name, export in PICK:
    parts.append(convert(name, export))
OUT.write_text('\n'.join(parts))
print('wrote', OUT, len(PICK), 'icons')
