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

    // Create the users table if it does not already exist
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

        // Check whether the gigs table already has a user_id column
        db.all("PRAGMA table_info(gigs)", (tableInfoErr, columns) => {
          if (tableInfoErr) {
            console.error(
              "Could not inspect gigs table:",
              tableInfoErr.message
            );
            return;
          }

          const hasUserId = columns.some(
            (column) => column.name === "user_id"
          );

          if (hasUserId) {
            console.log("Gig ownership column already exists.");
            createGigUserIndex();
            return;
          }

          // Add user ownership without deleting existing gig data
          db.run(
            `ALTER TABLE gigs
             ADD COLUMN user_id INTEGER REFERENCES users(id)`,
            (alterErr) => {
              if (alterErr) {
                console.error(
                  "Could not add gig ownership column:",
                  alterErr.message
                );
                return;
              }

              console.log("Added user ownership column to gigs.");

              // Preserve existing test/development gigs by assigning
              // unowned records to the first existing user.
              db.run(
                `UPDATE gigs
                 SET user_id = (
                   SELECT id
                   FROM users
                   ORDER BY id
                   LIMIT 1
                 )
                 WHERE user_id IS NULL
                   AND EXISTS (
                     SELECT 1 FROM users
                   )`,
                (migrationErr) => {
                  if (migrationErr) {
                    console.error(
                      "Could not migrate existing gigs:",
                      migrationErr.message
                    );
                    return;
                  }

                  console.log(
                    "Existing gigs assigned to an existing user."
                  );

                  createGigUserIndex();
                }
              );
            }
          );
        });
      }
    );
  });
});

// Index user_id because gig queries will frequently filter by logged-in user
function createGigUserIndex() {
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_gigs_user_id
     ON gigs(user_id)`,
    (indexErr) => {
      if (indexErr) {
        console.error(
          "Could not create gig ownership index:",
          indexErr.message
        );
        return;
      }

      console.log("Gig ownership index ready.");
    }
  );
}

module.exports = db;