/**
 * 文章 ID 写在 Markdown 顶部的 HTML 注释里，渲染不可见：
 * <!-- post-id: 577666966ba346cb -->
 *
 * 格式：UUID v4 去掉连字符后截取前 16 位小写十六进制。
 */
export const POST_ID_PATTERN = /<!--\s*post-id:\s*([a-f0-9]{16})\s*-->/;

/** 兼容旧写法：> 文章编号：xxxxxxxxxxxxxxxx */
export const LEGACY_POST_ID_PATTERN = /^>[ \t]*文章编号[ \t]*[:：][ \t]*([a-f0-9]{16})[ \t]*(?:\\)?\r?\n?/m;

export function extractPostId(raw: string): string | null {
  return raw.match(POST_ID_PATTERN)?.[1] ?? raw.match(LEGACY_POST_ID_PATTERN)?.[1] ?? null;
}

/** 从渲染正文中移除内部 ID 元信息（注释本身通常不渲染，顺带清掉旧 blockquote） */
export function stripPostIdMetadata(raw: string): string {
  return raw
    .replace(new RegExp(`${POST_ID_PATTERN.source}\\s*\\n?`), '')
    .replace(LEGACY_POST_ID_PATTERN, '');
}
