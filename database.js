const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("gigtracker.db", (err) => {
  if (err) {
    console.error("Could not connect to database:", err.message);
    return;
  }

  console.log("Connected to SQLite database.");

  db.run("PRAGMA foreign_keys = ON", (pragmaErr) => {
    if (pragmaErr) {
      console.error(
        "Could not enable foreign keys:",
        pragmaErr.message
      );
      return;
    }

    console.log("Foreign key enforcement enabled.");

    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      (userTableErr) => {
        if (userTableErr) {
          console.error(
            "Could not create users table:",
            userTableErr.message
          );
          return;
        }

        console.log("Users table ready.");
      }
    );
  });
});

module.exports = db;