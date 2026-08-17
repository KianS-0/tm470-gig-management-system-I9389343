PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS user_artist_follows;
DROP TABLE IF EXISTS user_venue_follows;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS gigs;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  genre TEXT,
  created_by_user_id INTEGER
    REFERENCES users(id)
);

CREATE TABLE venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  created_by_user_id INTEGER
    REFERENCES users(id)
);

CREATE TABLE gigs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL,
  venue_id INTEGER NOT NULL,
  gig_date TEXT NOT NULL,
  ticket_url TEXT,
  notes TEXT,
  user_id INTEGER REFERENCES users(id),
  FOREIGN KEY (artist_id)
    REFERENCES artists(id),
  FOREIGN KEY (venue_id)
    REFERENCES venues(id)
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK(status IN ('Going', 'Maybe', 'Went')),
  FOREIGN KEY (gig_id)
    REFERENCES gigs(id)
);

CREATE TABLE user_artist_follows (
  user_id INTEGER NOT NULL,
  artist_id INTEGER NOT NULL,
  followed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, artist_id),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  FOREIGN KEY (artist_id)
    REFERENCES artists(id)
    ON DELETE CASCADE
);

CREATE TABLE user_venue_follows (
  user_id INTEGER NOT NULL,
  venue_id INTEGER NOT NULL,
  followed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, venue_id),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  FOREIGN KEY (venue_id)
    REFERENCES venues(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_gigs_user_id
  ON gigs(user_id);

CREATE INDEX idx_artist_follows_artist
  ON user_artist_follows(artist_id);

CREATE INDEX idx_venue_follows_venue
  ON user_venue_follows(venue_id);

CREATE INDEX idx_artists_created_by_user
  ON artists(created_by_user_id);

CREATE INDEX idx_venues_created_by_user
  ON venues(created_by_user_id);