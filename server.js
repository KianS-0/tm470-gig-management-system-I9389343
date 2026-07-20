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
        <p><a href="/edit-gig/${gig.id}">Edit Gig</a></p>

        <form action="/delete-gig/${gig.id}" method="POST">
          <button class="delete-button" type="submit">Delete Gig</button>
        </form>
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

          .delete-button {
            background: #b91c1c;
            color: white;
            border: none;
            padding: 0.6rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
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

// Edit gig page - loads the selected gig from SQLite
app.get("/edit-gig/:id", (req, res) => {
  const gigId = req.params.id;

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
    WHERE gigs.id = ?
  `;

  db.get(sql, [gigId], (err, gig) => {
    if (err) {
      return res.status(500).send("Database error: " + err.message);
    }

    if (!gig) {
      return res.status(404).send("Gig not found.");
    }

    const status = gig.attendance_status || "Maybe";

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Edit Gig - GigTracker</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f4f4f4;
            color: #222;
          }

          nav {
            background: #111827;
            padding: 20px 40px;
          }

          nav a {
            color: white;
            text-decoration: none;
            margin-right: 20px;
            font-weight: bold;
          }

          .page {
            padding: 40px;
          }

          .card {
            background: white;
            padding: 30px;
            border-radius: 8px;
            max-width: 600px;
          }

          label {
            display: block;
            margin-top: 15px;
            margin-bottom: 5px;
            font-weight: bold;
          }

          input,
          select,
          textarea {
            width: 100%;
            padding: 10px;
            box-sizing: border-box;
            margin-bottom: 10px;
          }

          textarea {
            min-height: 100px;
          }

          button {
            padding: 12px 20px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
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

        <div class="page">
          <div class="card">
            <h1>Edit Gig</h1>

            <form action="/edit-gig/${gig.id}" method="POST">
              <label for="title">Gig Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value="${gig.title}"
                required
              >

              <label for="artist">Artist</label>
              <input
                type="text"
                id="artist"
                name="artist"
                value="${gig.artist_name}"
                required
              >

              <label for="venue">Venue</label>
              <input
                type="text"
                id="venue"
                name="venue"
                value="${gig.venue_name}"
                required
              >

              <label for="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value="${gig.venue_city}"
                required
              >

              <label for="gig-date">Date</label>
              <input
                type="date"
                id="gig-date"
                name="gig_date"
                value="${gig.gig_date}"
                required
              >

              <label for="ticket-url">Ticket Link</label>
              <input
                type="url"
                id="ticket-url"
                name="ticket_url"
                value="${gig.ticket_url || ""}"
              >

              <label for="attendance-status">Attendance Status</label>
              <select id="attendance-status" name="attendance_status">
                <option value="Going" ${status === "Going" ? "selected" : ""}>
                  Going
                </option>

                <option value="Maybe" ${status === "Maybe" ? "selected" : ""}>
                  Maybe
                </option>

                <option value="Went" ${status === "Went" ? "selected" : ""}>
                  Went
                </option>
              </select>

              <label for="notes">Notes</label>
              <textarea id="notes" name="notes">${gig.notes || ""}</textarea>

              <button type="submit">Save Changes</button>
            </form>
          </div>
        </div>
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

// Delete a gig
app.post("/delete-gig/:id", (req, res) => {
  const gigId = req.params.id;

  db.serialize(() => {
    db.run(
      "DELETE FROM attendance WHERE gig_id = ?",
      [gigId],
      (attendanceErr) => {
        if (attendanceErr) {
          return res.status(500).send("Attendance delete error: " + attendanceErr.message);
        }

        db.run(
          "DELETE FROM gigs WHERE id = ?",
          [gigId],
          (gigErr) => {
            if (gigErr) {
              return res.status(500).send("Gig delete error: " + gigErr.message);
            }

            res.redirect("/gigs");
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