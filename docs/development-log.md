 Development Log

## Backend development branch created

I created a separate Git branch before starting backend development. This preserved the original static HTML prototype and gave me a safe place to develop the Node.js, Express and SQLite version of the project.

This decision supports a controlled iterative development process because the original static prototype remains available as evidence while the backend/database version is developed separately.



I initialised the repository as a Node.js project so that it can be developed into an Express-based web application rather than remaining only a static HTML prototype.


I added an Express server and configured the project so the existing static pages can be served through backend routes. This is the first step in moving the prototype from static HTML towards a client-server web application.

Git commit: feat: serve static pages with ExpressWhat I did:I created server.js and added Express routes for the existing website pages, including home, gigs, add gig, artists, venues, login and register.Why I did it:This moved the project from separate static HTML files towards a client-server web application, which fits the original project plan and TM352 web-development concepts.What went well:The existing front-end pages could be reused, so I did not lose the earlier prototype work.What did not go well:The application still does not store data yet, so the next step is to add a SQLite database.What I learned:Express can serve different pages through routes, which provides the backend structure needed for later database-backed features.
Next we will add SQLite, but only after checking clean status.

