# Development Log

## Backend development branch created

**Git commit:** `docs: record start of backend development branch`

**What I did:**  
I created a separate Git branch called `express-sqlite-development` before starting backend development.

**Why I did it:**  
This preserved the original static HTML prototype and gave me a safe place to develop the Node.js, Express and SQLite version of the project without risking the existing work.

**What went well:**  
The branch was created successfully and the original `main` branch remained unchanged.

**What did not go well:**  
There were no major problems at this stage.

**What I learned:**  
Using a separate branch helps manage project risk and supports a controlled iterative development process. This links to TM354 software engineering practice because it creates a safer way to develop and review changes.

**Next step:**  
Initialise the project as a Node.js application.

---

## Node.js project initialised

**Git commit:** `build: initialise Node.js project`

**What I did:**  
I initialised the repository as a Node.js project, which created the `package.json` file.

**Why I did it:**  
The project needs to move beyond static HTML pages and become a server-based web application. Initialising Node.js prepares the project for an Express backend.

**What went well:**  
The `package.json` file was created successfully and recorded the basic project details.

**What did not go well:**  
I ran `npm init -y` twice by mistake, but this did not cause a problem because it simply rewrote the same project configuration.

**What I learned:**  
The `package.json` file is important because it records the project setup, scripts and dependencies. It will later show which packages are used for the backend and database.

**Next step:**  
Install Express so the application can be served through a backend server.

---

## Express web framework installed

**Git commit:** `build: install Express web framework`

**What I did:**  
I installed Express using npm.

**Why I did it:**  
Express is needed to create the backend server for the web application. This supports the move from a static website to a client-server web application.

**What went well:**  
Express installed successfully and npm reported no vulnerabilities.

**What did not go well:**  
No major issues occurred.

**What I learned:**  
Express provides the server-side routing needed to serve different pages and later process form submissions. This links to TM352 concepts because the project now has the basis for client-server interaction.

**Next step:**  
Create the first Express server file.

---

## Static pages served through Express

**Git commit:** `feat: serve static pages with Express`

**What I did:**  
I created `server.js` and added Express routes for the existing website pages, including home, gigs, add gig, artists, venues, login and register.

**Why I did it:**  
This moved the project from separate static HTML files towards a client-server web application. It also allowed the existing front-end prototype to be reused instead of discarded.

**What went well:**  
The server ran successfully using `npm start`, and the terminal showed that GigTracker was running on port 3000.

**What did not go well:**  
At this stage, the application still does not store data. The pages are now served through Express, but the gig information is still not database-backed.

**What I learned:**  
Express routes can be used to serve different pages in the application. This provides the backend structure needed for later database-backed features such as adding, editing and deleting gigs.

**Next step:**  
Install SQLite and begin adding persistent data storage.

---

## SQLite database package installed

**Git commit:** `build: install SQLite database package`

**What I did:**  
I installed the SQLite package using npm.

**Why I did it:**  
The project needs a database so that gig, artist, venue and attendance information can be stored persistently rather than being hard-coded into HTML pages.

**What went well:**  
SQLite installed successfully and npm reported no vulnerabilities.

**What did not go well:**  
No major issues occurred at this stage.

**What I learned:**  
Installing the database package is the first step towards implementing the data-management part of the project. This links to TM351 because the project will use relational database concepts such as tables, primary keys, foreign keys and relationships.

**Next step:**  
Create the first SQLite database schema.

---

## Initial SQLite database schema created

**Git commit planned:** `design: add initial SQLite database schema`

**What I did:**  
I created the first SQLite database schema for the gig management system. The schema includes tables for artists, venues, gigs and attendance.

**Why I did it:**  
The project needs a relational database so that gig information can be stored properly rather than being hard-coded into HTML pages. This supports the original project aim of creating a full web application with persistent data.

**What went well:**  
The main entities were clear from the project requirements. Artists, venues and gigs need separate tables because the same artist or venue may be linked to more than one gig.

**What did not go well:**  
At this stage the database schema is still basic. It does not yet include user accounts or following artists and venues. These will be added in later development increments.

**What I learned:**  
Separating data into related tables helps reduce duplication and supports data integrity. This links to TM351 database concepts such as tables, primary keys, foreign keys and relationships.

**Next step:**  
Connect the Express server to the SQLite database and create a way to initialise the database.


Git commit: build: add database initialisation script

What I did:
I created init-db.js and added an npm script so the SQLite database can be created from schema.sql.

Why I did it:
The project needs a repeatable way to create the database structure. This means the database can be recreated from the schema instead of relying on a manually created file.

What went well:
The database initialisation script ran successfully and created the database from schema.sql.

What did not go well:
The database is not connected to the website pages yet. At this stage it only creates the database structure.

What I learned:
Keeping schema.sql separate from the generated database file makes the database design clearer and easier to track in Git. This supports TM351 data-management concepts and TM354 version-control practice.

Next step:
Connect the Express application to SQLite and display gig data from the database.

---

## Express connected to SQLite database

**Git commit:** `feat: connect Express server to SQLite database`

**What I did:**  
I created `database.js` to manage the SQLite connection and added a `/db-test` route in `server.js`.

**Why I did it:**  
This was needed to prove that the Express backend can communicate with the SQLite database before I start making the main gig pages database-backed.

**What went well:**  
The `/db-test` route worked in the browser and returned the number of records in the `gigs` table.

**What did not go well:**  
The route is currently only a technical test. It does not yet display gig data through the normal user interface.

**What I learned:**  
The project now has a working connection between the browser, Express server and SQLite database. This links to TM352 client-server concepts and TM351 database concepts.

**Next step:**  
Add sample gig data and make the main gigs page display records from SQLite.

---

## Database seed script added

**Git commit:** `build: add database seed script`

**What I did:**  
I created `seed-db.js` and added an npm script so sample data can be inserted into the SQLite database.

**Why I did it:**  
The database needs test data before I can make the main gigs page display records from SQLite. The seed script gives me a repeatable way to add sample artists, venues, gigs and attendance records.

**What went well:**  
The script ran successfully using `npm run seed-db` and inserted sample data into the database.

**What did not go well:**  
I accidentally pasted JavaScript into the terminal instead of the file editor at first. This caused Bash syntax errors, but it did not damage the project files. I corrected this by pasting the code into `seed-db.js` and running it properly through npm.

**What I learned:**  
I learned the difference between writing code in a JavaScript file and running commands in the terminal. I also learned that seed scripts are useful because they make testing database-backed pages easier and repeatable.

**Next step:**  
Make the `/gigs` page display gig records from the SQLite database.