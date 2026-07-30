interface PostMetaProps {
  date: string;
  tags: string[];
  categoryLabel?: string;
  maxTags?: number;
}

export function PostMeta({ date, tags, categoryLabel, maxTags }: PostMetaProps) {
  const visibleTags = maxTags ? tags.slice(0, maxTags) : tags;

  return (
    <div className="post-meta">
      {categoryLabel && <span className="category-badge">{categoryLabel}</span>}
      <time dateTime={date}>{date}</time>
      {visibleTags.length > 0 && (
        <div className="tag-list">
          {visibleTags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
