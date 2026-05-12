const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

// Allow Express to read form data later
app.use(express.urlencoded({ extended: true }));

// Serve files such as HTML, CSS and images from this project folder
app.use(express.static(__dirname));

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Gigs page - reads gig data from SQLite
app.get("/gigs", (req, res) => {
  const sql = `
    SELECT 
      gigs.id,
      gigs.title,
      gigs.gig_date,
      gigs.ticket_url,
      gigs.notes,
      artists.name AS artist_name,
      venues.name AS venue_name,
      venues.city AS venue_city,
      attendance.status AS attendance_status
    FROM gigs
    JOIN artists ON gigs.artist_id = artists.id
    JOIN venues ON gigs.venue_id = venues.id
    LEFT JOIN attendance ON attendance.gig_id = gigs.id
    ORDER BY gigs.gig_date ASC
  `;

  db.all(sql, (err, gigs) => {
    if (err) {
      return res.status(500).send("Database error: " + err.message);
    }

    res.json(gigs);
  });
});

// Add gig page
app.get("/add-gig", (req, res) => {
  res.sendFile(path.join(__dirname, "add-gig.html"));
});

// Artists page
app.get("/artists", (req, res) => {
  res.sendFile(path.join(__dirname, "artists.html"));
});

// Venues page
app.get("/venues", (req, res) => {
  res.sendFile(path.join(__dirname, "venues.html"));
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/db-test", (req, res) => {
  db.get("SELECT COUNT(*) AS count FROM gigs", (err, row) => {
    if (err) {
      return res.status(500).send("Database error: " + err.message);
    }

    res.send(`Database connected. Number of gigs: ${row.count}`);
  });
});

app.listen(PORT, () => {
  console.log(`GigTracker server running on port ${PORT}`);
});