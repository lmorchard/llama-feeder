create table FeedItems (
  id integer primary key,
  feedId integer not null,
  guid text not null,
  title text,
  author text,
  link text,
  summary text,
  content text,
  pubdate timestamp,
  json text,
  createdAt timestamp not null,
  modifiedAt timestamp not null,
  foreign key (feedId) references feeds(id)
  unique (feedId, guid)
);
