const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath =
  process.env.DB_PATH ||
  path.join(__dirname, "gigtracker.db");

const schemaPath =
  path.join(__dirname, "schema.sql");

const schema =
  fs.readFileSync(schemaPath, "utf8");

const db = new sqlite3.Database(
  dbPath,
  (openErr) => {
    if (openErr) {
      console.error(
        "Error opening database:",
        openErr.message
      );

      process.exit(1);
    }

    db.exec(schema, (schemaErr) => {
      if (schemaErr) {
        console.error(
          "Error creating database:",
          schemaErr.message
        );

        db.close();
        process.exitCode = 1;
        return;
      }

      console.log(
        `Database created successfully: ${dbPath}`
      );

      db.close((closeErr) => {
        if (closeErr) {
          console.error(
            "Error closing database:",
            closeErr.message
          );

          process.exitCode = 1;
        }
      });
    });
  }
);