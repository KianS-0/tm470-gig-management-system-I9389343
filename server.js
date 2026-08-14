const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const db = require("./database");

const app = express();
const PORT = 3000;

// Allow Express to read form data later
app.use(express.urlencoded({ extended: true }));

// Keep users logged in while they use GigTracker
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "gigtracker-development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 2
    }
  })
);

// Require authentication for private GigTracker pages and actions
function requireLogin(req, res, next) {
  // Pages and files that anyone is allowed to access
  const publicPaths = [
    "/",
    "/index.html",
    "/login",
    "/login.html",
    "/register",
    "/register.html",
    "/session-test",
    "/styles.css",
    "/favicon.ico"
  ];

  const isPublicPath =
    publicPaths.includes(req.path) ||
    req.path.startsWith("/images/");

  if (isPublicPath) {
    return next();
  }

  // Logged-in users can continue normally
  if (req.session.userId) {
    return next();
  }

  // If someone manually visits a private page, send them to Login
  if (req.method === "GET") {
    return res.redirect("/login");
  }

  // Block unauthorised POST requests such as adding/deleting records
  return res.status(401).send(
    "You must be logged in to perform this action."
  );
}

app.use(requireLogin);

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
    WHERE gigs.user_id = ?
    ORDER BY gigs.gig_date ASC
  `;

  db.all(sql, [req.session.userId], (err, gigs) => {
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
            line-height: 1.6;
            background: #f5f5f5;
            color: #222;
          }

          nav {
            background-color: #111827;
            padding: 20px 40px;
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
        <link rel="stylesheet" href="/styles.css">
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
          <h1>My Gigs</h1>
          <p>
            Showing gigs for ${req.session.userName}.
          </p>
          ${gigCards || "<p>You have not added any gigs yet.</p>"}
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
      AND gigs.user_id = ?
    `;

  db.get(sql, [gigId, req.session.userId], (err, gig) => {
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
<link rel="stylesheet" href="/styles.css">
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

// Save changes from the Edit Gig form
app.post("/edit-gig/:id", (req, res) => {
  const gigId = req.params.id;

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

  const validStatuses = ["Going", "Maybe", "Went"];

  if (!validStatuses.includes(attendance_status)) {
    return res.status(400).send("Invalid attendance status.");
  }

  // Confirm ownership before making any database changes
  db.get(
    "SELECT id FROM gigs WHERE id = ? AND user_id = ?",
    [gigId, req.session.userId],
    (ownershipErr, ownedGig) => {
      if (ownershipErr) {
        return res
          .status(500)
          .send("Gig ownership check error: " + ownershipErr.message);
      }

      if (!ownedGig) {
        return res.status(404).send("Gig not found.");
      }

      // Continue updating the gig after artist and venue IDs are found
      const updateGig = (artistId, venueId) => {
        db.run(
          `UPDATE gigs
           SET title = ?,
               artist_id = ?,
               venue_id = ?,
               gig_date = ?,
               ticket_url = ?,
               notes = ?
           WHERE id = ?
             AND user_id = ?`,
          [
            title.trim(),
            artistId,
            venueId,
            gig_date,
            ticket_url ? ticket_url.trim() : "",
            notes ? notes.trim() : "",
            gigId,
            req.session.userId
          ],
          function (gigErr) {
            if (gigErr) {
              return res
                .status(500)
                .send("Gig update error: " + gigErr.message);
            }

            if (this.changes === 0) {
              return res.status(404).send("Gig not found.");
            }

            db.run(
              "UPDATE attendance SET status = ? WHERE gig_id = ?",
              [attendance_status, gigId],
              function (attendanceErr) {
                if (attendanceErr) {
                  return res
                    .status(500)
                    .send(
                      "Attendance update error: " +
                        attendanceErr.message
                    );
                }

                // Create an attendance record if one did not already exist
                if (this.changes === 0) {
                  db.run(
                    `INSERT INTO attendance (gig_id, status)
                     VALUES (?, ?)`,
                    [gigId, attendance_status],
                    (insertErr) => {
                      if (insertErr) {
                        return res
                          .status(500)
                          .send(
                            "Attendance insert error: " +
                              insertErr.message
                          );
                      }

                      res.redirect("/gigs");
                    }
                  );
                } else {
                  res.redirect("/gigs");
                }
              }
            );
          }
        );
      };

      // Find or create the artist
      db.get(
        "SELECT id FROM artists WHERE LOWER(name) = LOWER(?)",
        [artist.trim()],
        (artistFindErr, artistRow) => {
          if (artistFindErr) {
            return res
              .status(500)
              .send(
                "Artist lookup error: " +
                  artistFindErr.message
              );
          }

          const continueWithArtist = (artistId) => {
            // Find or create the venue
            db.get(
              `SELECT id FROM venues
               WHERE LOWER(name) = LOWER(?)
               AND LOWER(city) = LOWER(?)`,
              [venue.trim(), city.trim()],
              (venueFindErr, venueRow) => {
                if (venueFindErr) {
                  return res
                    .status(500)
                    .send(
                      "Venue lookup error: " +
                        venueFindErr.message
                    );
                }

                if (venueRow) {
                  updateGig(artistId, venueRow.id);
                } else {
                  db.run(
                    `INSERT INTO venues (name, city)
                     VALUES (?, ?)`,
                    [venue.trim(), city.trim()],
                    function (venueInsertErr) {
                      if (venueInsertErr) {
                        return res
                          .status(500)
                          .send(
                            "Venue insert error: " +
                              venueInsertErr.message
                          );
                      }

                      updateGig(artistId, this.lastID);
                    }
                  );
                }
              }
            );
          };

          if (artistRow) {
            continueWithArtist(artistRow.id);
          } else {
            db.run(
              "INSERT INTO artists (name) VALUES (?)",
              [artist.trim()],
              function (artistInsertErr) {
                if (artistInsertErr) {
                  return res
                    .status(500)
                    .send(
                      "Artist insert error: " +
                        artistInsertErr.message
                    );
                }

                continueWithArtist(this.lastID);
              }
            );
          }
        }
      );
    }
  );
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

  const selectedAttendanceStatus = attendance_status || "Maybe";
const validStatuses = ["Going", "Maybe", "Went"];

if (!validStatuses.includes(selectedAttendanceStatus)) {
  return res.status(400).send("Invalid attendance status.");
}

if (ticket_url) {
  try {
    const parsedTicketUrl = new URL(ticket_url);

    if (!["http:", "https:"].includes(parsedTicketUrl.protocol)) {
      return res.status(400).send("Ticket link must use http or https.");
    }
  } catch {
    return res.status(400).send("Invalid ticket link.");
  }
}

  db.serialize(() => {
    db.run(
      "INSERT OR IGNORE INTO artists (name) VALUES (?)",
      [artist]
    );

    db.run(
  `INSERT INTO venues (name, city)
   SELECT ?, ?
   WHERE NOT EXISTS (
     SELECT 1
     FROM venues
     WHERE LOWER(name) = LOWER(?)
       AND LOWER(city) = LOWER(?)
   )`,
  [
    venue.trim(),
    city.trim(),
    venue.trim(),
    city.trim()
  ]
);

    db.get(
      "SELECT id FROM artists WHERE name = ?",
      [artist],
      (artistErr, artistRow) => {
        if (artistErr) {
          return res.status(500).send("Artist database error: " + artistErr.message);
        }

        db.get(
          `SELECT id FROM venues
 WHERE LOWER(name) = LOWER(?)
   AND LOWER(city) = LOWER(?)
 ORDER BY id ASC
 LIMIT 1`,
[venue.trim(), city.trim()],
          (venueErr, venueRow) => {
            if (venueErr) {
              return res.status(500).send("Venue database error: " + venueErr.message);
            }

            db.run(
              `INSERT INTO gigs
 (title, artist_id, venue_id, gig_date, ticket_url, notes, user_id)
 VALUES (?, ?, ?, ?, ?, ?, ?)`,
[
  title,
  artistRow.id,
  venueRow.id,
  gig_date,
  ticket_url,
  notes,
  req.session.userId
],
              function (gigErr) {
                if (gigErr) {
                  return res.status(500).send("Gig database error: " + gigErr.message);
                }

                db.run(
                  "INSERT INTO attendance (gig_id, status) VALUES (?, ?)",
                  [this.lastID, selectedAttendanceStatus],
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

  // Confirm that the gig belongs to the logged-in user
  db.get(
    "SELECT id FROM gigs WHERE id = ? AND user_id = ?",
    [gigId, req.session.userId],
    (ownershipErr, ownedGig) => {
      if (ownershipErr) {
        return res
          .status(500)
          .send("Gig ownership check error: " + ownershipErr.message);
      }

      if (!ownedGig) {
        return res.status(404).send("Gig not found.");
      }

      db.serialize(() => {
        db.run(
          "DELETE FROM attendance WHERE gig_id = ?",
          [gigId],
          (attendanceErr) => {
            if (attendanceErr) {
              return res
                .status(500)
                .send(
                  "Attendance delete error: " +
                    attendanceErr.message
                );
            }

            db.run(
              "DELETE FROM gigs WHERE id = ? AND user_id = ?",
              [gigId, req.session.userId],
              function (gigErr) {
                if (gigErr) {
                  return res
                    .status(500)
                    .send(
                      "Gig delete error: " +
                        gigErr.message
                    );
                }

                if (this.changes === 0) {
                  return res.status(404).send("Gig not found.");
                }

                res.redirect("/gigs");
              }
            );
          }
        );
      });
    }
  );
});

// Add artist page
app.get("/add-artist", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Add Artist - GigTracker</title>

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

        main {
          padding: 40px;
        }

        form {
          background: white;
          padding: 30px;
          border-radius: 8px;
          max-width: 600px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
        }

        input {
          width: 100%;
          padding: 10px;
          margin-bottom: 20px;
          box-sizing: border-box;
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
<link rel="stylesheet" href="/styles.css">
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
        <h1>Add Artist</h1>

        <form action="/add-artist" method="POST">
          <label for="name">Artist Name</label>
          <input type="text" id="name" name="name" required>

          <button type="submit">Add Artist</button>
        </form>
      </main>
    </body>
    </html>
  `);
});

// Save a new artist to SQLite
app.post("/add-artist", (req, res) => {
  const name = req.body.name ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).send("Artist name is required.");
  }

  db.get(
    "SELECT id FROM artists WHERE LOWER(name) = LOWER(?)",
    [name],
    (findErr, existingArtist) => {
      if (findErr) {
        return res
          .status(500)
          .send("Artist lookup error: " + findErr.message);
      }

      if (existingArtist) {
        return res.status(400).send("This artist already exists.");
      }

      db.run(
        "INSERT INTO artists (name) VALUES (?)",
        [name],
        (insertErr) => {
          if (insertErr) {
            return res
              .status(500)
              .send("Artist insert error: " + insertErr.message);
          }

          res.redirect("/artists");
        }
      );
    }
  );
});

// Edit artist page - loads the selected artist from SQLite
app.get("/edit-artist/:id", (req, res) => {
  const artistId = req.params.id;

  db.get(
    "SELECT id, name FROM artists WHERE id = ?",
    [artistId],
    (err, artist) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      if (!artist) {
        return res.status(404).send("Artist not found.");
      }

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Edit Artist - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/gigs">Gigs</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
            <a href="/add-gig">Add Gig</a>
            <a href="/login">Login</a>
            <a href="/register">Register</a>
          </nav>

          <main>
            <h1>Edit Artist</h1>

            <form action="/edit-artist/${artist.id}" method="POST">
              <label for="name">Artist Name</label>

              <input
                type="text"
                id="name"
                name="name"
                value="${artist.name}"
                required
              >

              <button type="submit">Save Changes</button>
            </form>

            <p><a href="/artists">Return to Artists</a></p>
          </main>
        </body>
        </html>
      `);
    }
  );
});

// Save changes made to an artist
app.post("/edit-artist/:id", (req, res) => {
  const artistId = req.params.id;
  const name = req.body.name ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).send("Artist name is required.");
  }

  db.get(
    "SELECT id FROM artists WHERE LOWER(name) = LOWER(?) AND id != ?",
    [name, artistId],
    (findErr, existingArtist) => {
      if (findErr) {
        return res
          .status(500)
          .send("Artist lookup error: " + findErr.message);
      }

      if (existingArtist) {
        return res.status(400).send("This artist already exists.");
      }

      db.run(
        "UPDATE artists SET name = ? WHERE id = ?",
        [name, artistId],
        function (updateErr) {
          if (updateErr) {
            return res
              .status(500)
              .send("Artist update error: " + updateErr.message);
          }

          if (this.changes === 0) {
            return res.status(404).send("Artist not found.");
          }

          res.redirect("/artists");
        }
      );
    }
  );
});

// Delete an artist from SQLite
app.post("/delete-artist/:id", (req, res) => {
  const artistId = req.params.id;

  // Prevent deletion when the artist is linked to an existing gig
  db.get(
    "SELECT COUNT(*) AS gigCount FROM gigs WHERE artist_id = ?",
    [artistId],
    (countErr, row) => {
      if (countErr) {
        return res
          .status(500)
          .send("Artist lookup error: " + countErr.message);
      }

      if (row.gigCount > 0) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cannot Delete Artist - GigTracker</title>
            <link rel="stylesheet" href="/styles.css">
          </head>

          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/gigs">Gigs</a>
              <a href="/artists">Artists</a>
              <a href="/venues">Venues</a>
              <a href="/add-gig">Add Gig</a>
              <a href="/login">Login</a>
              <a href="/register">Register</a>
            </nav>

            <main>
              <h1>Artist cannot be deleted</h1>

              <div class="message">
                <p>This artist is currently linked to one or more gigs.</p>
                <p>Delete or edit those gigs before deleting the artist.</p>
                <a href="/artists">Return to Artists</a>
              </div>
            </main>
          </body>
          </html>
        `);
      }

      db.run(
        "DELETE FROM artists WHERE id = ?",
        [artistId],
        function (deleteErr) {
          if (deleteErr) {
            return res
              .status(500)
              .send("Artist delete error: " + deleteErr.message);
          }

          if (this.changes === 0) {
            return res.status(404).send("Artist not found.");
          }

          res.redirect("/artists");
        }
      );
    }
  );
});

// Artists page - displays artists from SQLite
app.get("/artists", (req, res) => {
  db.all(
    "SELECT id, name FROM artists ORDER BY name ASC",
    [],
    (err, artists) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      const artistCards = artists.length
        ? artists
            .map(
              (artist) => `
                <section class="artist-card">
                  <h2>${artist.name}</h2>
                  <p><a href="/edit-artist/${artist.id}">Edit Artist</a></p>
                  <form action="/delete-artist/${artist.id}" method="POST">
                <button class="delete-button" type="submit">Delete Artist</button>
              </form>
                </section>
              `
            )
            .join("")
        : "<p>No artists found.</p>";

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Artists - GigTracker</title>

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

            main {
              padding: 40px;
            }

            .artist-card {
              background: white;
              padding: 20px;
              margin-bottom: 15px;
              border-radius: 8px;
              max-width: 600px;
            }
          </style>
<link rel="stylesheet" href="/styles.css">
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
            <h1>Artists</h1>
            <p>Browse and manage artists in your collection.</p>
            <p><a href="/add-artist">Add Artist</a></p>

            ${artistCards}
          </main>
        </body>
        </html>
      `);
    }
  );
});

// Add Venue page
app.get("/add-venue", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Add Venue - GigTracker</title>
      <link rel="stylesheet" href="/styles.css">
    </head>

    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/gigs">Gigs</a>
        <a href="/artists">Artists</a>
        <a href="/venues">Venues</a>
        <a href="/add-gig">Add Gig</a>
        <a href="/login">Login</a>
        <a href="/register">Register</a>
      </nav>

      <main>
        <h1>Add Venue</h1>

        <form action="/add-venue" method="POST">
          <label for="name">Venue Name</label>
          <input
            type="text"
            id="name"
            name="name"
            required
          >

          <label for="city">City</label>
          <input
            type="text"
            id="city"
            name="city"
            required
          >

          <button type="submit">Add Venue</button>
        </form>

        <p><a href="/venues">Return to Venues</a></p>
      </main>
    </body>
    </html>
  `);
});

// Save a new venue to SQLite
app.post("/add-venue", (req, res) => {
  const name = req.body.name ? req.body.name.trim() : "";
  const city = req.body.city ? req.body.city.trim() : "";

  if (!name || !city) {
    return res.status(400).send("Venue name and city are required.");
  }

  db.get(
    `SELECT id FROM venues
     WHERE LOWER(name) = LOWER(?)
     AND LOWER(city) = LOWER(?)`,
    [name, city],
    (findErr, existingVenue) => {
      if (findErr) {
        return res
          .status(500)
          .send("Venue lookup error: " + findErr.message);
      }

      if (existingVenue) {
        return res.status(400).send("This venue already exists.");
      }

      db.run(
        "INSERT INTO venues (name, city) VALUES (?, ?)",
        [name, city],
        (insertErr) => {
          if (insertErr) {
            return res
              .status(500)
              .send("Venue insert error: " + insertErr.message);
          }

          res.redirect("/venues");
        }
      );
    }
  );
});

// Edit venue page
app.get("/edit-venue/:id", (req, res) => {
  const venueId = req.params.id;

  db.get(
    "SELECT id, name, city FROM venues WHERE id = ?",
    [venueId],
    (err, venue) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      if (!venue) {
        return res.status(404).send("Venue not found.");
      }

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Edit Venue - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/gigs">Gigs</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
            <a href="/add-gig">Add Gig</a>
            <a href="/login">Login</a>
            <a href="/register">Register</a>
          </nav>

          <main>
            <h1>Edit Venue</h1>

            <form action="/edit-venue/${venue.id}" method="POST">
              <label for="name">Venue Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value="${venue.name}"
                required
              >

              <label for="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value="${venue.city || ""}"
                required
              >

              <button type="submit">Save Changes</button>
            </form>

            <p><a href="/venues">Return to Venues</a></p>
          </main>
        </body>
        </html>
      `);
    }
  );
});

// Save changes made to a venue
app.post("/edit-venue/:id", (req, res) => {
  const venueId = req.params.id;
  const name = req.body.name ? req.body.name.trim() : "";
  const city = req.body.city ? req.body.city.trim() : "";

  if (!name || !city) {
    return res.status(400).send("Venue name and city are required.");
  }

  db.get(
    `SELECT id FROM venues
     WHERE LOWER(name) = LOWER(?)
     AND LOWER(city) = LOWER(?)
     AND id != ?`,
    [name, city, venueId],
    (findErr, existingVenue) => {
      if (findErr) {
        return res
          .status(500)
          .send("Venue lookup error: " + findErr.message);
      }

      if (existingVenue) {
        return res.status(400).send("This venue already exists.");
      }

      db.run(
        "UPDATE venues SET name = ?, city = ? WHERE id = ?",
        [name, city, venueId],
        function (updateErr) {
          if (updateErr) {
            return res
              .status(500)
              .send("Venue update error: " + updateErr.message);
          }

          if (this.changes === 0) {
            return res.status(404).send("Venue not found.");
          }

          res.redirect("/venues");
        }
      );
    }
  );
});

// Delete a venue from SQLite
app.post("/delete-venue/:id", (req, res) => {
  const venueId = req.params.id;

  // Prevent deletion when the venue is linked to an existing gig
  db.get(
    "SELECT COUNT(*) AS gigCount FROM gigs WHERE venue_id = ?",
    [venueId],
    (countErr, row) => {
      if (countErr) {
        return res
          .status(500)
          .send("Venue lookup error: " + countErr.message);
      }

      if (row.gigCount > 0) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cannot Delete Venue - GigTracker</title>
            <link rel="stylesheet" href="/styles.css">
          </head>

          <body>
            <nav>
              <a href="/">Home</a>
              <a href="/gigs">Gigs</a>
              <a href="/artists">Artists</a>
              <a href="/venues">Venues</a>
              <a href="/add-gig">Add Gig</a>
              <a href="/login">Login</a>
              <a href="/register">Register</a>
            </nav>

            <main>
              <h1>Venue cannot be deleted</h1>

              <div class="message">
                <p>This venue is currently linked to one or more gigs.</p>
                <p>Delete or edit those gigs before deleting the venue.</p>
                <a href="/venues">Return to Venues</a>
              </div>
            </main>
          </body>
          </html>
        `);
      }

      db.run(
        "DELETE FROM venues WHERE id = ?",
        [venueId],
        function (deleteErr) {
          if (deleteErr) {
            return res
              .status(500)
              .send("Venue delete error: " + deleteErr.message);
          }

          if (this.changes === 0) {
            return res.status(404).send("Venue not found.");
          }

          res.redirect("/venues");
        }
      );
    }
  );
});

// Venues page - displays venues from SQLite
app.get("/venues", (req, res) => {
  db.all(
    "SELECT id, name, city FROM venues ORDER BY name COLLATE NOCASE",
    [],
    (err, venues) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      const venueCards = venues.length
        ? venues
            .map(
              (venue) => `
                <section class="venue-card">
                  <h2>${venue.name}</h2>
                  <p><strong>City:</strong> ${venue.city || "Not specified"}</p>
                  <p><a href="/edit-venue/${venue.id}">Edit Venue</a></p>
                  <form action="/delete-venue/${venue.id}" method="POST">
                    <button class="delete-button" type="submit">Delete Venue</button>
                  </form>
                </section>
              `
            )
            .join("")
        : "<p>No venues found.</p>";

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Venues - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/gigs">Gigs</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
            <a href="/add-gig">Add Gig</a>
            <a href="/login">Login</a>
            <a href="/register">Register</a>
          </nav>

          <main>
            <h1>Venues</h1>
            <p>View the venues currently stored in GigTracker.</p>
            <p><a class="button" href="/add-venue">Add Venue</a></p>

            ${venueCards}
          </main>
        </body>
        </html>
      `);
    }
  );
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Log a user into GigTracker
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Please enter your email and password.");
  }

  const cleanEmail = email.trim().toLowerCase();

  db.get(
    `SELECT id, name, email, password_hash
     FROM users
     WHERE email = ?`,
    [cleanEmail],
    (lookupErr, user) => {
      if (lookupErr) {
        return res.status(500).send("Login error: " + lookupErr.message);
      }

      // Use the same message for a wrong email or password
      // so the application does not reveal registered email addresses.
      if (!user) {
        return res.status(401).send("Incorrect email or password.");
      }

      bcrypt.compare(password, user.password_hash, (compareErr, matches) => {
        if (compareErr) {
          return res.status(500).send("Could not verify password.");
        }

        if (!matches) {
          return res.status(401).send("Incorrect email or password.");
        }

        // Store only the information needed to identify the logged-in user.
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        req.session.save((sessionErr) => {
          if (sessionErr) {
            return res.status(500).send("Could not start login session.");
          }

          res.redirect("/");
        });
      });
    }
  );
});

// Check whether a user is currently logged in
app.get("/session-test", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      loggedIn: false
    });
  }

  res.json({
    loggedIn: true,
    user: {
      id: req.session.userId,
      name: req.session.userName,
      email: req.session.userEmail
    }
  });
});

// Log the current user out
app.post("/logout", (req, res) => {
  req.session.destroy((sessionErr) => {
    if (sessionErr) {
      return res.status(500).send("Could not log out.");
    }

    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// Register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

// Create a new user account
app.post("/register", (req, res) => {
  const { name, email, password, confirm_password } = req.body;

  // Check that all required fields were submitted
  if (!name || !email || !password || !confirm_password) {
    return res.status(400).send("Please complete all registration fields.");
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || !cleanEmail) {
    return res.status(400).send("Name and email cannot be blank.");
  }

  // Password must be at least 8 characters
  if (password.length < 8) {
    return res
      .status(400)
      .send("Password must be at least 8 characters long.");
  }

  // Both password fields must match
  if (password !== confirm_password) {
    return res.status(400).send("Passwords do not match.");
  }

  // Check whether the email address is already registered
  db.get(
    "SELECT id FROM users WHERE email = ?",
    [cleanEmail],
    (lookupErr, existingUser) => {
      if (lookupErr) {
        return res
          .status(500)
          .send("Registration error: " + lookupErr.message);
      }

      if (existingUser) {
        return res
          .status(400)
          .send("An account with this email already exists.");
      }

      // Hash the password so the plain password is never stored
      bcrypt.hash(password, 12, (hashErr, passwordHash) => {
        if (hashErr) {
          return res.status(500).send("Could not secure password.");
        }

        db.run(
          `INSERT INTO users (name, email, password_hash)
           VALUES (?, ?, ?)`,
          [cleanName, cleanEmail, passwordHash],
          function (insertErr) {
            if (insertErr) {
              return res
                .status(500)
                .send("Could not create account: " + insertErr.message);
            }

            res.redirect("/login");
          }
        );
      });
    }
  );
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