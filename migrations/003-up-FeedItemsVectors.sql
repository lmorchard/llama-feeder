create virtual table FeedItemsVectors using vec0(
  feedItemId integer primary key,
  titleAndSummaryEmbedding float[384]
);
