create table Feeds (
  id integer primary key,
  url text not null unique,
  title text not null,
  description text,
  link text,
  status text,
  statusText text,
  lastValidated timestamp,
  lastParsed timestamp,
  json text,
  createdAt timestamp not null,
  modifiedAt timestamp not null
);
