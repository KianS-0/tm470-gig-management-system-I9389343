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
  });
});

module.exports = db;