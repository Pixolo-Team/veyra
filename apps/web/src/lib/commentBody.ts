/**
 * Comment bodies.
 *
 * The API stores a comment body as opaque JSON — `commentBodySchema` is a
 * passthrough object — because the plan is a rich-text editor and changing the
 * column later would mean migrating every comment ever written. So the shape is
 * settled here, once, in the ProseMirror form that editor will emit: a `doc` of
 * `paragraph`s of `text`. Today's composer only produces plain paragraphs; when
 * the editor arrives it writes marks and mention nodes into the same envelope
 * and nothing stored has to move.
 *
 * `bodyText` is deliberately tolerant. It reads whatever nodes it finds rather
 * than assuming this exact shape, so a body written by a later, richer editor
 * still renders as readable text in an older tab.
 */

export interface CommentBody extends Record<string, unknown> {
  type: 'doc';
  content: unknown[];
}

export function toBody(text: string): CommentBody {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    type: 'doc',
    content: paragraphs.map((block) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: block }],
    })),
  };
}

/** Every text node in the body, joined — paragraphs separated by blank lines. */
export function bodyText(body: unknown): string {
  const blocks: string[] = [];

  const walk = (node: unknown, into: string[]): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof record.text === 'string') {
      into.push(record.text);
      return;
    }
    if (!Array.isArray(record.content)) return;
    if (record.type === 'paragraph') {
      const parts: string[] = [];
      for (const child of record.content) walk(child, parts);
      blocks.push(parts.join(''));
      return;
    }
    for (const child of record.content) walk(child, into);
  };

  walk(body, blocks);
  return blocks.join('\n\n').trim();
}
