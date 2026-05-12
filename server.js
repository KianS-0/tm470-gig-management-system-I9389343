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

// Gigs page - reads gig data from SQLite and displays it as HTML
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

    const gigCards = gigs.map((gig) => `
      <section class="gig-card">
        <h2>${gig.title}</h2>
        <p><strong>Artist:</strong> ${gig.artist_name}</p>
        <p><strong>Venue:</strong> ${gig.venue_name}, ${gig.venue_city}</p>
        <p><strong>Date:</strong> ${gig.gig_date}</p>
        <p><strong>Attendance:</strong> ${gig.attendance_status || "Not set"}</p>
        <p><strong>Notes:</strong> ${gig.notes || "No notes added"}</p>
        <p><a href="${gig.ticket_url}" target="_blank">Ticket link</a></p>
      </section>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Gigs - GigTracker</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f5f5f5;
            color: #222;
          }

          nav {
            background: #111;
            padding: 1rem;
          }

          nav a {
            color: white;
            margin-right: 1rem;
            text-decoration: none;
            font-weight: bold;
          }

          main {
            max-width: 900px;
            margin: 2rem auto;
            padding: 1rem;
          }

          .gig-card {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
          }

          .gig-card h2 {
            margin-top: 0;
          }
        </style>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/gigs">Gigs</a>
          <a href="/add-gig">Add Gig</a>
          <a href="/artists">Artists</a>
          <a href="/venues">Venues</a>
          <a href="/login">Login</a>
          <a href="/register">Register</a>
        </nav>

        <main>
          <h1>Gigs</h1>
          <p>This page displays gig records from the SQLite database.</p>
          ${gigCards || "<p>No gigs found.</p>"}
        </main>
      </body>
      </html>
    `);
  });
});

// Add gig page
app.get("/add-gig", (req, res) => {
  res.sendFile(path.join(__dirname, "add-gig.html"));
});

// Save a new gig from the Add Gig form
app.post("/add-gig", (req, res) => {
  const {
    title,
    artist,
    venue,
    city,
    gig_date,
    ticket_url,
    attendance_status,
    notes
  } = req.body;

  if (!title || !artist || !venue || !city || !gig_date) {
    return res.status(400).send("Missing required fields.");
  }

  db.serialize(() => {
    db.run(
      "INSERT OR IGNORE INTO artists (name) VALUES (?)",
      [artist]
    );

    db.run(
      "INSERT INTO venues (name, city) VALUES (?, ?)",
      [venue, city]
    );

    db.get(
      "SELECT id FROM artists WHERE name = ?",
      [artist],
      (artistErr, artistRow) => {
        if (artistErr) {
          return res.status(500).send("Artist database error: " + artistErr.message);
        }

        db.get(
          "SELECT id FROM venues WHERE name = ? AND city = ? ORDER BY id DESC LIMIT 1",
          [venue, city],
          (venueErr, venueRow) => {
            if (venueErr) {
              return res.status(500).send("Venue database error: " + venueErr.message);
            }

            db.run(
              `INSERT INTO gigs 
               (title, artist_id, venue_id, gig_date, ticket_url, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                title,
                artistRow.id,
                venueRow.id,
                gig_date,
                ticket_url,
                notes
              ],
              function (gigErr) {
                if (gigErr) {
                  return res.status(500).send("Gig database error: " + gigErr.message);
                }

                db.run(
                  "INSERT INTO attendance (gig_id, status) VALUES (?, ?)",
                  [this.lastID, attendance_status || "Maybe"],
                  (attendanceErr) => {
                    if (attendanceErr) {
                      return res.status(500).send("Attendance database error: " + attendanceErr.message);
                    }

                    res.redirect("/gigs");
                  }
                );
              }
            );
          }
        );
      }
    );
  });
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

// Database test route
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