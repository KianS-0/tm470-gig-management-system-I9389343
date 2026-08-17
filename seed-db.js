const path = require("path");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();

const dbPath =
  process.env.DB_PATH ||
  path.join(__dirname, "gigtracker.db");

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(
      sql,
      params,
      function (err) {
        if (err) {
          reject(err);
          return;
        }

        resolve(this);
      }
    );
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(
      sql,
      params,
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row);
      }
    );
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function seedDatabase() {
  await run("PRAGMA foreign_keys = ON");

  const counts = await get(`
    SELECT
      (SELECT COUNT(*) FROM users)
        AS users,
      (SELECT COUNT(*) FROM artists)
        AS artists,
      (SELECT COUNT(*) FROM venues)
        AS venues,
      (SELECT COUNT(*) FROM gigs)
        AS gigs
  `);

  if (
    counts.users > 0 ||
    counts.artists > 0 ||
    counts.venues > 0 ||
    counts.gigs > 0
  ) {
    console.log(
      "Seed skipped: database already contains data."
    );

    return;
  }

  const passwordHash =
    await bcrypt.hash("password123", 12);

  await run(
    `INSERT INTO users
     (name, email, password_hash)
     VALUES (?, ?, ?)`,
    [
      "Example User",
      "example@example.com",
      passwordHash
    ]
  );

  await run(
    `INSERT INTO artists
     (name, genre, created_by_user_id)
     VALUES (
       ?,
       ?,
       (
         SELECT id
         FROM users
         WHERE email = ?
       )
     )`,
    [
      "The Example Band",
      "Indie Rock",
      "example@example.com"
    ]
  );

  await run(
    `INSERT INTO venues
     (name, city, created_by_user_id)
     VALUES (
       ?,
       ?,
       (
         SELECT id
         FROM users
         WHERE email = ?
       )
     )`,
    [
      "Example Music Hall",
      "London",
      "example@example.com"
    ]
  );

  await run(
    `INSERT INTO gigs
     (
       title,
       artist_id,
       venue_id,
       gig_date,
       ticket_url,
       notes,
       user_id
     )
     SELECT
       ?,
       artists.id,
       venues.id,
       ?,
       ?,
       ?,
       users.id
     FROM artists
     JOIN venues
       ON venues.name = ?
       AND venues.city = ?
     JOIN users
       ON users.email = ?
     WHERE artists.name = ?`,
    [
      "The Example Band Live",
      "2026-12-20",
      "https://example.com/tickets",
      "Sample gig used to test the application.",
      "Example Music Hall",
      "London",
      "example@example.com",
      "The Example Band"
    ]
  );

  await run(
    `INSERT INTO attendance
     (gig_id, status)
     SELECT id, ?
     FROM gigs
     WHERE title = ?
       AND user_id = (
         SELECT id
         FROM users
         WHERE email = ?
       )`,
    [
      "Maybe",
      "The Example Band Live",
      "example@example.com"
    ]
  );

  await run(
    `INSERT INTO user_artist_follows
     (user_id, artist_id)
     SELECT users.id, artists.id
     FROM users, artists
     WHERE users.email = ?
       AND artists.name = ?`,
    [
      "example@example.com",
      "The Example Band"
    ]
  );

  await run(
    `INSERT INTO user_venue_follows
     (user_id, venue_id)
     SELECT users.id, venues.id
     FROM users, venues
     WHERE users.email = ?
       AND venues.name = ?
       AND venues.city = ?`,
    [
      "example@example.com",
      "Example Music Hall",
      "London"
    ]
  );

  console.log(
    `Sample data inserted successfully: ${dbPath}`
  );

  console.log(
    "Sample login: example@example.com / password123"
  );
}

seedDatabase()
  .catch((err) => {
    console.error(
      "Error seeding database:",
      err.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabase();
    } catch (err) {
      console.error(
        "Error closing database:",
        err.message
      );

      process.exitCode = 1;
    }
  });