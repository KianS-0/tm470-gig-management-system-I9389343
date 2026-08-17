const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const crypto = require("crypto");
const db = require("./database");

const app = express();
const PORT = 3000;
// Do not advertise that the application uses Express
app.disable("x-powered-by");

// Allow Express to read form data later
app.use(express.urlencoded({ extended: true }));

// Keep users logged in while they use GigTracker
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      crypto.randomBytes(32).toString("hex"),
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

  // API requests should return JSON instead of redirecting to Login
if (req.path.startsWith("/api/")) {
  return res.status(401).json({
    error: "Authentication required."
  });
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

app.get("/dashboard", (req, res) => {
  const userId = req.session.userId;

  const statsSql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM gigs
        WHERE user_id = ?
      ) AS total_gigs,

      (
        SELECT COUNT(*)
        FROM gigs
        WHERE user_id = ?
          AND DATE(gig_date) >= DATE('now')
      ) AS upcoming_gigs,

      (
        SELECT COUNT(*)
        FROM gigs
        JOIN attendance
          ON attendance.gig_id = gigs.id
        WHERE gigs.user_id = ?
          AND attendance.status = 'Going'
      ) AS going_gigs,

      (
        SELECT COUNT(*)
        FROM user_artist_follows
        WHERE user_id = ?
      ) AS followed_artists,

      (
        SELECT COUNT(*)
        FROM user_venue_follows
        WHERE user_id = ?
      ) AS followed_venues
  `;

  db.get(
    statsSql,
    [
      userId,
      userId,
      userId,
      userId,
      userId
    ],
    (statsErr, stats) => {
      if (statsErr) {
        return res
          .status(500)
          .send("Database error: " + statsErr.message);
      }

      const upcomingSql = `
        SELECT
          gigs.id,
          gigs.title,
          gigs.gig_date,
          artists.name AS artist_name,
          venues.name AS venue_name,
          venues.city AS venue_city,
          attendance.status AS attendance_status
        FROM gigs
        JOIN artists
          ON artists.id = gigs.artist_id
        JOIN venues
          ON venues.id = gigs.venue_id
        LEFT JOIN attendance
          ON attendance.gig_id = gigs.id
        WHERE gigs.user_id = ?
          AND DATE(gigs.gig_date) >= DATE('now')
        ORDER BY gigs.gig_date ASC
        LIMIT 5
      `;

      db.all(
        upcomingSql,
        [userId],
        (upcomingErr, upcomingGigs) => {
          if (upcomingErr) {
            return res
              .status(500)
              .send(
                "Database error: " +
                upcomingErr.message
              );
          }

          const escapeHtml = (value) =>
            String(value || "")
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;")
              .replaceAll("'", "&#039;");

          const upcomingCards =
            upcomingGigs.length
              ? upcomingGigs
                  .map(
                    (gig) => `
                      <section class="gig-card">
                        <h3>
                          ${escapeHtml(gig.title)}
                        </h3>

                        <p>
                          <strong>Artist:</strong>
                          ${escapeHtml(
                            gig.artist_name
                          )}
                        </p>

                        <p>
                          <strong>Venue:</strong>
                          ${escapeHtml(
                            gig.venue_name
                          )},
                          ${escapeHtml(
                            gig.venue_city ||
                            "Not specified"
                          )}
                        </p>

                        <p>
                          <strong>Date:</strong>
                          ${escapeHtml(
                            gig.gig_date
                          )}
                        </p>

                        <p>
                          <strong>Attendance:</strong>
                          ${escapeHtml(
                            gig.attendance_status ||
                            "Not set"
                          )}
                        </p>

                        <p>
                          <a href="/edit-gig/${gig.id}">
                            View / Edit Gig
                          </a>
                        </p>
                      </section>
                    `
                  )
                  .join("")
              : `
                <p>
                  You currently have no upcoming gigs.
                </p>
              `;

          res.send(`
            <!DOCTYPE html>
            <html lang="en">

            <head>
              <meta charset="UTF-8">

              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              >

              <title>
                Dashboard - GigTracker
              </title>

              <link
                rel="stylesheet"
                href="/styles.css"
              >
            </head>

            <body>
              <nav>
                <a href="/">Home</a>
                <a href="/dashboard">Dashboard</a>
                <a href="/gigs">Gigs</a>
                <a href="/add-gig">Add Gig</a>
                <a href="/artists">Artists</a>
                <a href="/venues">Venues</a>
              </nav>

              <main>
                <h1>Dashboard</h1>

                <p>
                  Welcome,
                  ${escapeHtml(
                    req.session.userName
                  )}.
                </p>

                <section class="gig-card">
                  <h2>Your GigTracker Summary</h2>

                  <p>
                    <strong>Total gigs:</strong>
                    ${stats.total_gigs}
                  </p>

                  <p>
                    <strong>Upcoming gigs:</strong>
                    ${stats.upcoming_gigs}
                  </p>

                  <p>
                    <strong>Marked Going:</strong>
                    ${stats.going_gigs}
                  </p>

                  <p>
                    <strong>Followed artists:</strong>
                    ${stats.followed_artists}
                  </p>

                  <p>
                    <strong>Followed venues:</strong>
                    ${stats.followed_venues}
                  </p>
                </section>

                <h2>Next Upcoming Gigs</h2>

                ${upcomingCards}
              </main>
            </body>
            </html>
          `);
        }
      );
    }
  );
});

// JSON API - return gigs belonging to the logged-in user
app.get("/api/gigs", (req, res) => {
  const sql = `
    SELECT
      gigs.id,
      gigs.title,
      gigs.gig_date,
      gigs.ticket_url,
      gigs.notes,
      artists.id AS artist_id,
      artists.name AS artist_name,
      venues.id AS venue_id,
      venues.name AS venue_name,
      venues.city AS venue_city,
      attendance.status AS attendance_status
    FROM gigs
    JOIN artists
      ON artists.id = gigs.artist_id
    JOIN venues
      ON venues.id = gigs.venue_id
    LEFT JOIN attendance
      ON attendance.gig_id = gigs.id
    WHERE gigs.user_id = ?
    ORDER BY gigs.gig_date ASC
  `;

  db.all(
    sql,
    [req.session.userId],
    (err, gigs) => {
      if (err) {
        return res.status(500).json({
          error: "Could not retrieve gigs."
        });
      }

      res.json(gigs);
    }
  );
});

// JSON API - return artists and the logged-in user's follow state
app.get("/api/artists", (req, res) => {
  const sql = `
    SELECT
      artists.id,
      artists.name,
      CASE
        WHEN user_artist_follows.user_id IS NULL THEN 0
        ELSE 1
      END AS is_followed
    FROM artists
    LEFT JOIN user_artist_follows
      ON user_artist_follows.artist_id = artists.id
      AND user_artist_follows.user_id = ?
    ORDER BY artists.name COLLATE NOCASE
  `;

  db.all(
    sql,
    [req.session.userId],
    (err, artists) => {
      if (err) {
        return res.status(500).json({
          error: "Could not retrieve artists."
        });
      }

      res.json(artists);
    }
  );
});

// JSON API - return venues and the logged-in user's follow state
app.get("/api/venues", (req, res) => {
  const sql = `
    SELECT
      venues.id,
      venues.name,
      venues.city,
      CASE
        WHEN user_venue_follows.user_id IS NULL THEN 0
        ELSE 1
      END AS is_followed
    FROM venues
    LEFT JOIN user_venue_follows
      ON user_venue_follows.venue_id = venues.id
      AND user_venue_follows.user_id = ?
    ORDER BY venues.name COLLATE NOCASE
  `;

  db.all(
    sql,
    [req.session.userId],
    (err, venues) => {
      if (err) {
        return res.status(500).json({
          error: "Could not retrieve venues."
        });
      }

      res.json(venues);
    }
  );
});

// Gigs page - reads gig data from SQLite and displays it as HTML
app.get("/gigs", (req, res) => {
  const search = req.query.search
    ? req.query.search.trim()
    : "";

  const city = req.query.city
    ? req.query.city.trim()
    : "";

  const dateFrom = req.query.date_from || "";
  const dateTo = req.query.date_to || "";
  const attendance = req.query.attendance || "";

  const followedArtists =
    req.query.followed_artists === "1";

  const followedVenues =
    req.query.followed_venues === "1";

  // Escape values before placing them back into HTML form fields
  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const conditions = [
    "gigs.user_id = ?"
  ];

  const params = [
    req.session.userId
  ];

  if (search) {
    conditions.push(`
      (
        LOWER(gigs.title) LIKE LOWER(?)
        OR LOWER(artists.name) LIKE LOWER(?)
        OR LOWER(venues.name) LIKE LOWER(?)
      )
    `);

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue
    );
  }

  if (city) {
    conditions.push(
      "LOWER(venues.city) LIKE LOWER(?)"
    );

    params.push(`%${city}%`);
  }

  if (dateFrom) {
    conditions.push(
      "DATE(gigs.gig_date) >= DATE(?)"
    );

    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(
      "DATE(gigs.gig_date) <= DATE(?)"
    );

    params.push(dateTo);
  }

  if (
    attendance === "Going" ||
    attendance === "Maybe" ||
    attendance === "Went"
  ) {
    conditions.push(
      "attendance.status = ?"
    );

    params.push(attendance);
  }

  if (followedArtists) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM user_artist_follows
        WHERE user_artist_follows.user_id = ?
          AND user_artist_follows.artist_id = gigs.artist_id
      )
    `);

    params.push(req.session.userId);
  }

  if (followedVenues) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM user_venue_follows
        WHERE user_venue_follows.user_id = ?
          AND user_venue_follows.venue_id = gigs.venue_id
      )
    `);

    params.push(req.session.userId);
  }

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
    JOIN artists
      ON gigs.artist_id = artists.id
    JOIN venues
      ON gigs.venue_id = venues.id
    LEFT JOIN attendance
      ON attendance.gig_id = gigs.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY gigs.gig_date ASC
  `;

  db.all(
    sql,
    params,
    (err, gigs) => {
      if (err) {
        return res
          .status(500)
          .send(
            "Database error: " + err.message
          );
      }

      const gigCards = gigs.length
        ? gigs
            .map((gig) => {
              const ticketLink = gig.ticket_url
                ? `
                  <p>
                    <a
                      href="${escapeHtml(gig.ticket_url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ticket link
                    </a>
                  </p>
                `
                : `
                  <p>
                    <strong>Ticket link:</strong>
                    Not provided
                  </p>
                `;

              return `
                <section class="gig-card">
                  <h2>
                    ${escapeHtml(gig.title)}
                  </h2>

                  <p>
                    <strong>Artist:</strong>
                    ${escapeHtml(gig.artist_name)}
                  </p>

                  <p>
                    <strong>Venue:</strong>
                    ${escapeHtml(gig.venue_name)},
                    ${escapeHtml(
                      gig.venue_city ||
                      "Not specified"
                    )}
                  </p>

                  <p>
                    <strong>Date:</strong>
                    ${escapeHtml(gig.gig_date)}
                  </p>

                  <p>
                    <strong>Attendance:</strong>
                    ${escapeHtml(
                      gig.attendance_status ||
                      "Not set"
                    )}
                  </p>

                  <p>
                    <strong>Notes:</strong>
                    ${escapeHtml(
                      gig.notes ||
                      "No notes added"
                    )}
                  </p>

                  
                  ${ticketLink}

<p>
  <a href="/export-gig/${gig.id}">
    Export to Calendar (.ics)
  </a>
</p>

<p>
  <a href="/edit-gig/${gig.id}">
    Edit Gig
  </a>
</p>

<form
  action="/delete-gig/${gig.id}"
  method="POST"
>
                    <button
                      class="delete-button"
                      type="submit"
                    >
                      Delete Gig
                    </button>
                  </form>
                </section>
              `;
            })
            .join("")
        : `
          <p>
            No gigs match the selected filters.
          </p>
        `;

      const filtersAreActive =
        search ||
        city ||
        dateFrom ||
        dateTo ||
        attendance ||
        followedArtists ||
        followedVenues;

      res.send(`
        <!DOCTYPE html>
        <html lang="en">

        <head>
          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <title>Gigs - GigTracker</title>

          <link
            rel="stylesheet"
            href="/styles.css"
          >
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
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
              Showing gigs for
              ${escapeHtml(req.session.userName)}.
            </p>

            <section class="gig-card">
              <h2>Search and Filter</h2>

              <form
                action="/gigs"
                method="GET"
              >
                <label for="search">
                  Search title, artist or venue
                </label>

                <input
                  type="text"
                  id="search"
                  name="search"
                  value="${escapeHtml(search)}"
                  placeholder="e.g. Amazons"
                >

                <label for="city">
                  City
                </label>

                <input
                  type="text"
                  id="city"
                  name="city"
                  value="${escapeHtml(city)}"
                  placeholder="e.g. London"
                >

                <label for="date_from">
                  From date
                </label>

                <input
                  type="date"
                  id="date_from"
                  name="date_from"
                  value="${escapeHtml(dateFrom)}"
                >

                <label for="date_to">
                  To date
                </label>

                <input
                  type="date"
                  id="date_to"
                  name="date_to"
                  value="${escapeHtml(dateTo)}"
                >

                <label for="attendance">
                  Attendance
                </label>

                <select
                  id="attendance"
                  name="attendance"
                >
                  <option value="">
                    Any status
                  </option>

                  <option
                    value="Going"
                    ${
                      attendance === "Going"
                        ? "selected"
                        : ""
                    }
                  >
                    Going
                  </option>

                  <option
                    value="Maybe"
                    ${
                      attendance === "Maybe"
                        ? "selected"
                        : ""
                    }
                  >
                    Maybe
                  </option>

                  <option
                    value="Went"
                    ${
                      attendance === "Went"
                        ? "selected"
                        : ""
                    }
                  >
                    Went
                  </option>
                </select>

                <p>
                  <label>
                    <input
                      type="checkbox"
                      name="followed_artists"
                      value="1"
                      ${
                        followedArtists
                          ? "checked"
                          : ""
                      }
                    >
                    Followed artists only
                  </label>
                </p>

                <p>
                  <label>
                    <input
                      type="checkbox"
                      name="followed_venues"
                      value="1"
                      ${
                        followedVenues
                          ? "checked"
                          : ""
                      }
                    >
                    Followed venues only
                  </label>
                </p>

                <button type="submit">
                  Apply Filters
                </button>

                ${
                  filtersAreActive
                    ? `
                      <p>
                        <a href="/gigs">
                          Clear Filters
                        </a>
                      </p>
                    `
                    : ""
                }
              </form>
            </section>

            <h2>
              ${
                filtersAreActive
                  ? `Results (${gigs.length})`
                  : `All Gigs (${gigs.length})`
              }
            </h2>

            ${gigCards}
          </main>
        </body>
        </html>
      `);
    }
  );
});

app.get("/export-gig/:id", (req, res) => {
  const gigId = req.params.id;

  db.get(
    `SELECT
       gigs.id,
       gigs.title,
       gigs.gig_date,
       gigs.ticket_url,
       gigs.notes,
       artists.name AS artist_name,
       venues.name AS venue_name,
       venues.city AS venue_city
     FROM gigs
     JOIN artists
       ON gigs.artist_id = artists.id
     JOIN venues
       ON gigs.venue_id = venues.id
     WHERE gigs.id = ?
       AND gigs.user_id = ?`,
    [gigId, req.session.userId],
    (err, gig) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      if (!gig) {
        return res.status(404).send("Gig not found.");
      }

      const gigDate = new Date(
        `${gig.gig_date}T00:00:00Z`
      );

      if (Number.isNaN(gigDate.getTime())) {
        return res.status(400).send("Invalid gig date.");
      }

      const nextDate = new Date(gigDate);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);

      const formatCalendarDate = (date) => {
        const year = date.getUTCFullYear();

        const month = String(
          date.getUTCMonth() + 1
        ).padStart(2, "0");

        const day = String(
          date.getUTCDate()
        ).padStart(2, "0");

        return `${year}${month}${day}`;
      };

      const escapeCalendarText = (value) =>
        String(value || "")
          .replaceAll("\\", "\\\\")
          .replaceAll("\r\n", "\\n")
          .replaceAll("\n", "\\n")
          .replaceAll(",", "\\,")
          .replaceAll(";", "\\;");

      const dtStamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");

      const location = [
        gig.venue_name,
        gig.venue_city
      ]
        .filter(Boolean)
        .join(", ");

      const descriptionParts = [
        `Artist: ${gig.artist_name}`,
        gig.notes
          ? `Notes: ${gig.notes}`
          : "",
        gig.ticket_url
          ? `Tickets: ${gig.ticket_url}`
          : ""
      ].filter(Boolean);

      const calendar = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GigTracker//Gig Calendar//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:gig-${gig.id}-user-${req.session.userId}@gigtracker.local`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART;VALUE=DATE:${formatCalendarDate(gigDate)}`,
        `DTEND;VALUE=DATE:${formatCalendarDate(nextDate)}`,
        `SUMMARY:${escapeCalendarText(gig.title)}`,
        `LOCATION:${escapeCalendarText(location)}`,
        `DESCRIPTION:${escapeCalendarText(
          descriptionParts.join("\n")
        )}`,
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");

      const safeFilename = gig.title
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "gig";

      res.setHeader(
        "Content-Type",
        "text/calendar; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFilename}.ics"`
      );

      res.send(calendar);
    }
  );
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
    const escapeHtml = (value) =>
      String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

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
          <a href="/dashboard">Dashboard</a>
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
                value="${escapeHtml(gig.title)}"
                required
              >

              <label for="artist">Artist</label>
              <input
                type="text"
                id="artist"
                name="artist"
                value="${escapeHtml(gig.artist_name)}"
                required
              >

              <label for="venue">Venue</label>
              <input
                type="text"
                id="venue"
                name="venue"
                value="${escapeHtml(gig.venue_name)}"
                required
              >

              <label for="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value="${escapeHtml(gig.venue_city)}"
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
                value="${escapeHtml(gig.ticket_url || "")}"
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
              <textarea id="notes" name="notes">${escapeHtml(gig.notes || "")}</textarea>

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
  `INSERT INTO venues
   (name, city, created_by_user_id)
   VALUES (?, ?, ?)`,
  [
    venue.trim(),
    city.trim(),
    req.session.userId
  ],
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
  `INSERT INTO artists
   (name, created_by_user_id)
   VALUES (?, ?)`,
  [artist.trim(), req.session.userId],
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
  `INSERT OR IGNORE INTO artists
   (name, created_by_user_id)
   VALUES (?, ?)`,
  [artist.trim(), req.session.userId]
);

    db.run(
  `INSERT INTO venues
   (name, city, created_by_user_id)
   SELECT ?, ?, ?
   WHERE NOT EXISTS (
     SELECT 1
     FROM venues
     WHERE LOWER(name) = LOWER(?)
       AND LOWER(city) = LOWER(?)
   )`,
  [
    venue.trim(),
    city.trim(),
    req.session.userId,
    venue.trim(),
    city.trim()
  ]
);

    db.get(
  "SELECT id FROM artists WHERE LOWER(name) = LOWER(?)",
  [artist.trim()],
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
        <a href="/dashboard">Dashboard</a>
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
          `INSERT INTO artists (name, created_by_user_id)
          VALUES (?, ?)`,
          [name, req.session.userId],
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

// Edit artist page - only the creator can edit the artist
app.get("/edit-artist/:id", (req, res) => {
  const artistId = req.params.id;

  db.get(
    `SELECT id, name
     FROM artists
     WHERE id = ?
       AND created_by_user_id = ?`,
    [artistId, req.session.userId],
    (err, artist) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      if (!artist) {
        return res.status(404).send("Artist not found.");
      }

      const escapeHtml = (value) =>
        String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >
          <title>Edit Artist - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/gigs">Gigs</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
            <a href="/add-gig">Add Gig</a>
          </nav>

          <main>
            <h1>Edit Artist</h1>

            <form
              action="/edit-artist/${artist.id}"
              method="POST"
            >
              <label for="name">Artist Name</label>

              <input
                type="text"
                id="name"
                name="name"
                value="${escapeHtml(artist.name)}"
                required
              >

              <button type="submit">
                Save Changes
              </button>
            </form>

            <p>
              <a href="/artists">
                Return to Artists
              </a>
            </p>
          </main>
        </body>
        </html>
      `);
    }
  );
});

// Save changes made to an artist - creator only
app.post("/edit-artist/:id", (req, res) => {
  const artistId = req.params.id;
  const name = req.body.name
    ? req.body.name.trim()
    : "";

  if (!name) {
    return res
      .status(400)
      .send("Artist name is required.");
  }

  // Confirm that this artist belongs to the logged-in user
  db.get(
    `SELECT id
     FROM artists
     WHERE id = ?
       AND created_by_user_id = ?`,
    [artistId, req.session.userId],
    (ownershipErr, artist) => {
      if (ownershipErr) {
        return res
          .status(500)
          .send(
            "Artist ownership check error: " +
              ownershipErr.message
          );
      }

      if (!artist) {
        return res.status(404).send("Artist not found.");
      }

      // Do not rename an artist used by another user's gig
      db.get(
        `SELECT COUNT(*) AS otherUserGigCount
         FROM gigs
         WHERE artist_id = ?
           AND user_id != ?`,
        [artistId, req.session.userId],
        (usageErr, usageRow) => {
          if (usageErr) {
            return res
              .status(500)
              .send(
                "Artist usage check error: " +
                  usageErr.message
              );
          }

          if (usageRow.otherUserGigCount > 0) {
            return res
              .status(400)
              .send(
                "This artist is used by another user's gig and cannot be renamed."
              );
          }

          db.get(
            `SELECT id
             FROM artists
             WHERE LOWER(name) = LOWER(?)
               AND id != ?`,
            [name, artistId],
            (findErr, existingArtist) => {
              if (findErr) {
                return res
                  .status(500)
                  .send(
                    "Artist lookup error: " +
                      findErr.message
                  );
              }

              if (existingArtist) {
                return res
                  .status(400)
                  .send("This artist already exists.");
              }

              db.run(
                `UPDATE artists
                 SET name = ?
                 WHERE id = ?
                   AND created_by_user_id = ?`,
                [
                  name,
                  artistId,
                  req.session.userId
                ],
                function (updateErr) {
                  if (updateErr) {
                    return res
                      .status(500)
                      .send(
                        "Artist update error: " +
                          updateErr.message
                      );
                  }

                  if (this.changes === 0) {
                    return res
                      .status(404)
                      .send("Artist not found.");
                  }

                  res.redirect("/artists");
                }
              );
            }
          );
        }
      );
    }
  );
});

// Delete an artist from SQLite - creator only
app.post("/delete-artist/:id", (req, res) => {
  const artistId = req.params.id;

  // Confirm that the artist belongs to the logged-in user
  db.get(
    `SELECT id
     FROM artists
     WHERE id = ?
       AND created_by_user_id = ?`,
    [artistId, req.session.userId],
    (ownershipErr, artist) => {
      if (ownershipErr) {
        return res
          .status(500)
          .send(
            "Artist ownership check error: " +
              ownershipErr.message
          );
      }

      if (!artist) {
        return res.status(404).send("Artist not found.");
      }

      // Do not delete an artist that is still used by a gig
      db.get(
        `SELECT COUNT(*) AS gigCount
         FROM gigs
         WHERE artist_id = ?`,
        [artistId],
        (countErr, row) => {
          if (countErr) {
            return res
              .status(500)
              .send(
                "Artist lookup error: " +
                  countErr.message
              );
          }

          if (row.gigCount > 0) {
            return res
              .status(400)
              .send(
                "This artist is linked to one or more gigs and cannot be deleted."
              );
          }

          db.run(
            `DELETE FROM artists
             WHERE id = ?
               AND created_by_user_id = ?`,
            [
              artistId,
              req.session.userId
            ],
            function (deleteErr) {
              if (deleteErr) {
                return res
                  .status(500)
                  .send(
                    "Artist delete error: " +
                      deleteErr.message
                  );
              }

              if (this.changes === 0) {
                return res
                  .status(404)
                  .send("Artist not found.");
              }

              res.redirect("/artists");
            }
          );
        }
      );
    }
  );
});

// Artists page - displays artists from SQLite
app.get("/artists", (req, res) => {
  db.all(
    `SELECT
       artists.id,
       artists.name,
       artists.created_by_user_id,
       CASE
         WHEN user_artist_follows.user_id IS NULL THEN 0
         ELSE 1
       END AS is_followed
     FROM artists
     LEFT JOIN user_artist_follows
       ON user_artist_follows.artist_id = artists.id
       AND user_artist_follows.user_id = ?
     ORDER BY artists.name COLLATE NOCASE`,
    [req.session.userId],
    (err, artists) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      const escapeHtml = (value) =>
        String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const artistCards = artists.length
        ? artists
            .map((artist) => {
              const followSection = artist.is_followed
                ? `
                  <p><strong>Following</strong></p>

                  <form
                    action="/unfollow-artist/${artist.id}"
                    method="POST"
                  >
                    <button type="submit">
                      Unfollow
                    </button>
                  </form>
                `
                : `
                  <form
                    action="/follow-artist/${artist.id}"
                    method="POST"
                  >
                    <button type="submit">
                      Follow
                    </button>
                  </form>
                `;

              const managementSection =
                artist.created_by_user_id ===
                req.session.userId
                  ? `
                    <p>
                      <a href="/edit-artist/${artist.id}">
                        Edit Artist
                      </a>
                    </p>

                    <form
                      action="/delete-artist/${artist.id}"
                      method="POST"
                    >
                      <button
                        class="delete-button"
                        type="submit"
                      >
                        Delete Artist
                      </button>
                    </form>
                  `
                  : "";

              return `
                <section class="artist-card">
                  <h2>
                    ${escapeHtml(artist.name)}
                  </h2>

                  ${followSection}

                  ${managementSection}
                </section>
              `;
            })
            .join("")
        : "<p>No artists found.</p>";

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <title>Artists - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/gigs">Gigs</a>
            <a href="/add-gig">Add Gig</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
          </nav>

          <main>
            <h1>Artists</h1>

            <p>
              Browse, manage and follow artists in your collection.
            </p>

            <p>
              <a href="/add-artist">
                Add Artist
              </a>
            </p>

            ${artistCards}
          </main>
        </body>
        </html>
      `);
    }
  );
});

app.post("/follow-artist/:id", (req, res) => {
  const artistId = req.params.id;

  db.get(
    "SELECT id FROM artists WHERE id = ?",
    [artistId],
    (artistErr, artist) => {
      if (artistErr) {
        return res
          .status(500)
          .send("Database error: " + artistErr.message);
      }

      if (!artist) {
        return res.status(404).send("Artist not found.");
      }

      db.run(
        `INSERT OR IGNORE INTO user_artist_follows
         (user_id, artist_id)
         VALUES (?, ?)`,
        [req.session.userId, artistId],
        (followErr) => {
          if (followErr) {
            return res
              .status(500)
              .send("Database error: " + followErr.message);
          }

          res.redirect("/artists");
        }
      );
    }
  );
});

app.post("/unfollow-artist/:id", (req, res) => {
  const artistId = req.params.id;

  db.run(
    `DELETE FROM user_artist_follows
     WHERE user_id = ?
       AND artist_id = ?`,
    [req.session.userId, artistId],
    (err) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      res.redirect("/artists");
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
        <a href="/dashboard">Dashboard</a>
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
  `INSERT INTO venues (name, city, created_by_user_id)
   VALUES (?, ?, ?)`,
  [name, city, req.session.userId],
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

// Edit venue page - only the creator can edit the venue
app.get("/edit-venue/:id", (req, res) => {
  const venueId = req.params.id;

  db.get(
    `SELECT id, name, city
     FROM venues
     WHERE id = ?
       AND created_by_user_id = ?`,
    [venueId, req.session.userId],
    (err, venue) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      if (!venue) {
        return res.status(404).send("Venue not found.");
      }

      const escapeHtml = (value) =>
        String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >
          <title>Edit Venue - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/gigs">Gigs</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
            <a href="/add-gig">Add Gig</a>
          </nav>

          <main>
            <h1>Edit Venue</h1>

            <form
              action="/edit-venue/${venue.id}"
              method="POST"
            >
              <label for="name">Venue Name</label>

              <input
                type="text"
                id="name"
                name="name"
                value="${escapeHtml(venue.name)}"
                required
              >

              <label for="city">City</label>

              <input
                type="text"
                id="city"
                name="city"
                value="${escapeHtml(venue.city)}"
                required
              >

              <button type="submit">
                Save Changes
              </button>
            </form>

            <p>
              <a href="/venues">
                Return to Venues
              </a>
            </p>
          </main>
        </body>
        </html>
      `);
    }
  );
});

// Save changes made to a venue - creator only
app.post("/edit-venue/:id", (req, res) => {
  const venueId = req.params.id;
  const name = req.body.name
    ? req.body.name.trim()
    : "";
  const city = req.body.city
    ? req.body.city.trim()
    : "";

  if (!name || !city) {
    return res
      .status(400)
      .send("Venue name and city are required.");
  }

  // Confirm that this venue belongs to the logged-in user
  db.get(
    `SELECT id
     FROM venues
     WHERE id = ?
       AND created_by_user_id = ?`,
    [venueId, req.session.userId],
    (ownershipErr, venue) => {
      if (ownershipErr) {
        return res
          .status(500)
          .send(
            "Venue ownership check error: " +
              ownershipErr.message
          );
      }

      if (!venue) {
        return res.status(404).send("Venue not found.");
      }

      // Do not rename a venue used by another user's gig
      db.get(
        `SELECT COUNT(*) AS otherUserGigCount
         FROM gigs
         WHERE venue_id = ?
           AND user_id != ?`,
        [venueId, req.session.userId],
        (usageErr, usageRow) => {
          if (usageErr) {
            return res
              .status(500)
              .send(
                "Venue usage check error: " +
                  usageErr.message
              );
          }

          if (usageRow.otherUserGigCount > 0) {
            return res
              .status(400)
              .send(
                "This venue is used by another user's gig and cannot be renamed."
              );
          }

          db.get(
            `SELECT id
             FROM venues
             WHERE LOWER(name) = LOWER(?)
               AND LOWER(city) = LOWER(?)
               AND id != ?`,
            [name, city, venueId],
            (findErr, existingVenue) => {
              if (findErr) {
                return res
                  .status(500)
                  .send(
                    "Venue lookup error: " +
                      findErr.message
                  );
              }

              if (existingVenue) {
                return res
                  .status(400)
                  .send("This venue already exists.");
              }

              db.run(
                `UPDATE venues
                 SET name = ?,
                     city = ?
                 WHERE id = ?
                   AND created_by_user_id = ?`,
                [
                  name,
                  city,
                  venueId,
                  req.session.userId
                ],
                function (updateErr) {
                  if (updateErr) {
                    return res
                      .status(500)
                      .send(
                        "Venue update error: " +
                          updateErr.message
                      );
                  }

                  if (this.changes === 0) {
                    return res
                      .status(404)
                      .send("Venue not found.");
                  }

                  res.redirect("/venues");
                }
              );
            }
          );
        }
      );
    }
  );
});

// Delete a venue from SQLite - creator only
app.post("/delete-venue/:id", (req, res) => {
  const venueId = req.params.id;

  // Confirm that the venue belongs to the logged-in user
  db.get(
    `SELECT id
     FROM venues
     WHERE id = ?
       AND created_by_user_id = ?`,
    [venueId, req.session.userId],
    (ownershipErr, venue) => {
      if (ownershipErr) {
        return res
          .status(500)
          .send(
            "Venue ownership check error: " +
              ownershipErr.message
          );
      }

      if (!venue) {
        return res.status(404).send("Venue not found.");
      }

      // Do not delete a venue that is still used by a gig
      db.get(
        `SELECT COUNT(*) AS gigCount
         FROM gigs
         WHERE venue_id = ?`,
        [venueId],
        (countErr, row) => {
          if (countErr) {
            return res
              .status(500)
              .send(
                "Venue lookup error: " +
                  countErr.message
              );
          }

          if (row.gigCount > 0) {
            return res
              .status(400)
              .send(
                "This venue is linked to one or more gigs and cannot be deleted."
              );
          }

          db.run(
            `DELETE FROM venues
             WHERE id = ?
               AND created_by_user_id = ?`,
            [
              venueId,
              req.session.userId
            ],
            function (deleteErr) {
              if (deleteErr) {
                return res
                  .status(500)
                  .send(
                    "Venue delete error: " +
                      deleteErr.message
                  );
              }

              if (this.changes === 0) {
                return res
                  .status(404)
                  .send("Venue not found.");
              }

              res.redirect("/venues");
            }
          );
        }
      );
    }
  );
});

// Venues page - displays venues from SQLite
app.get("/venues", (req, res) => {
  db.all(
    `SELECT
       venues.id,
       venues.name,
       venues.city,
       venues.created_by_user_id,
       CASE
         WHEN user_venue_follows.user_id IS NULL THEN 0
         ELSE 1
       END AS is_followed
     FROM venues
     LEFT JOIN user_venue_follows
       ON user_venue_follows.venue_id = venues.id
       AND user_venue_follows.user_id = ?
     ORDER BY venues.name COLLATE NOCASE`,
    [req.session.userId],
    (err, venues) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      const escapeHtml = (value) =>
        String(value || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const venueCards = venues.length
        ? venues
            .map((venue) => {
              const followSection = venue.is_followed
                ? `
                  <p><strong>Following</strong></p>

                  <form
                    action="/unfollow-venue/${venue.id}"
                    method="POST"
                  >
                    <button type="submit">
                      Unfollow
                    </button>
                  </form>
                `
                : `
                  <form
                    action="/follow-venue/${venue.id}"
                    method="POST"
                  >
                    <button type="submit">
                      Follow
                    </button>
                  </form>
                `;

              const managementSection =
                venue.created_by_user_id ===
                req.session.userId
                  ? `
                    <p>
                      <a href="/edit-venue/${venue.id}">
                        Edit Venue
                      </a>
                    </p>

                    <form
                      action="/delete-venue/${venue.id}"
                      method="POST"
                    >
                      <button
                        class="delete-button"
                        type="submit"
                      >
                        Delete Venue
                      </button>
                    </form>
                  `
                  : "";

              return `
                <section class="venue-card">
                  <h2>
                    ${escapeHtml(venue.name)}
                  </h2>

                  <p>
                    <strong>City:</strong>
                    ${escapeHtml(
                      venue.city || "Not specified"
                    )}
                  </p>

                  ${followSection}

                  ${managementSection}
                </section>
              `;
            })
            .join("")
        : "<p>No venues found.</p>";

      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <title>Venues - GigTracker</title>
          <link rel="stylesheet" href="/styles.css">
        </head>

        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/gigs">Gigs</a>
            <a href="/artists">Artists</a>
            <a href="/venues">Venues</a>
            <a href="/add-gig">Add Gig</a>
          </nav>

          <main>
            <h1>Venues</h1>

            <p>
              View, manage and follow venues in GigTracker.
            </p>

            <p>
              <a class="button" href="/add-venue">
                Add Venue
              </a>
            </p>

            ${venueCards}
          </main>
        </body>
        </html>
      `);
    }
  );
});

app.post("/follow-venue/:id", (req, res) => {
  const venueId = req.params.id;

  db.get(
    "SELECT id FROM venues WHERE id = ?",
    [venueId],
    (venueErr, venue) => {
      if (venueErr) {
        return res
          .status(500)
          .send("Database error: " + venueErr.message);
      }

      if (!venue) {
        return res.status(404).send("Venue not found.");
      }

      db.run(
        `INSERT OR IGNORE INTO user_venue_follows
         (user_id, venue_id)
         VALUES (?, ?)`,
        [req.session.userId, venueId],
        (followErr) => {
          if (followErr) {
            return res
              .status(500)
              .send("Database error: " + followErr.message);
          }

          res.redirect("/venues");
        }
      );
    }
  );
});

app.post("/unfollow-venue/:id", (req, res) => {
  const venueId = req.params.id;

  db.run(
    `DELETE FROM user_venue_follows
     WHERE user_id = ?
       AND venue_id = ?`,
    [req.session.userId, venueId],
    (err) => {
      if (err) {
        return res
          .status(500)
          .send("Database error: " + err.message);
      }

      res.redirect("/venues");
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
    return res
      .status(400)
      .send("Please enter your email and password.");
  }

  const cleanEmail = email.trim().toLowerCase();

  db.get(
    `SELECT id, name, email, password_hash
     FROM users
     WHERE email = ?`,
    [cleanEmail],
    (lookupErr, user) => {
      if (lookupErr) {
        return res
          .status(500)
          .send("Login error: " + lookupErr.message);
      }

      // Use the same message for a wrong email or password
      // so the application does not reveal registered email addresses.
      if (!user) {
        return res
          .status(401)
          .send("Incorrect email or password.");
      }

      bcrypt.compare(
        password,
        user.password_hash,
        (compareErr, matches) => {
          if (compareErr) {
            return res
              .status(500)
              .send("Could not verify password.");
          }

          if (!matches) {
            return res
              .status(401)
              .send("Incorrect email or password.");
          }

          // Regenerate the session after login
          // to reduce session fixation risk.
          req.session.regenerate((regenerateErr) => {
            if (regenerateErr) {
              return res
                .status(500)
                .send("Could not start login session.");
            }

            req.session.userId = user.id;
            req.session.userName = user.name;
            req.session.userEmail = user.email;

            req.session.save((sessionErr) => {
              if (sessionErr) {
                return res
                  .status(500)
                  .send("Could not start login session.");
              }

              res.redirect("/");
            });
          });
        }
      );
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

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(cleanEmail)) {
    return res
      .status(400)
      .send("Please enter a valid email address.");
  }

  if (!cleanName || !cleanEmail) {
    return res.status(400).send("Name and email cannot be blank.");
  }

  // Password must be at least 8 characters
  if (password.length < 8) {
    return res
      .status(400)
      .send("Password must be at least 8 characters long.");
  }

    if (password.length > 128) {
    return res
      .status(400)
      .send("Password must be 128 characters or fewer.");
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