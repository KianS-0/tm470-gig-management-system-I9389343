const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("gigtracker.db");

const schema = fs.readFileSync("schema.sql", "utf8");

db.exec(schema, (err) => {
  if (err) {
    console.error("Error creating database:", err.message);
    process.exit(1);
  }

  console.log("Database created successfully from schema.sql");
});

db.close();