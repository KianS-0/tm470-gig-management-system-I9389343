const express = require("express");
const path = require("path");

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

// Gigs page
app.get("/gigs", (req, res) => {
  res.sendFile(path.join(__dirname, "gigs.html"));
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

app.listen(PORT, () => {
  console.log(`GigTracker server running on port ${PORT}`);
});