DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS gigs;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS venues;

CREATE TABLE artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    genre TEXT
);

CREATE TABLE venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL
);

CREATE TABLE gigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL,
    venue_id INTEGER NOT NULL,
    gig_date TEXT NOT NULL,
    ticket_url TEXT,
    notes TEXT,
    FOREIGN KEY (artist_id) REFERENCES artists(id),
    FOREIGN KEY (venue_id) REFERENCES venues(id)
);

CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gig_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Going', 'Maybe', 'Went')),
    FOREIGN KEY (gig_id) REFERENCES gigs(id)
);