const db = require("./database");

db.serialize(() => {
  db.run("DELETE FROM attendance");
  db.run("DELETE FROM gigs");
  db.run("DELETE FROM artists");
  db.run("DELETE FROM venues");

  db.run(
    "INSERT INTO artists (name, genre) VALUES (?, ?)",
    ["The Example Band", "Indie Rock"]
  );

  db.run(
    "INSERT INTO venues (name, city) VALUES (?, ?)",
    ["Example Music Hall", "London"]
  );

  db.run(
    `INSERT INTO gigs 
     (title, artist_id, venue_id, gig_date, ticket_url, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "The Example Band Live",
      1,
      1,
      "2026-05-20",
      "https://example.com/tickets",
      "Initial sample gig used to test database display."
    ]
  );

  db.run(
    "INSERT INTO attendance (gig_id, status) VALUES (?, ?)",
    [1, "Maybe"]
  );
});

db.close((err) => {
  if (err) {
    console.error("Error closing database:", err.message);
  } else {
    console.log("Sample data inserted successfully.");
  }
});