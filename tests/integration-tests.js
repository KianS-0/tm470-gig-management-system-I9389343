const assert = require("assert");

const BASE_URL =
  process.env.TEST_BASE_URL ||
  "http://localhost:3000";

const TEST_USER = {
  email: "test@example.com",
  password: "password123"
};

const SECOND_USER = {
  email: "second@example.com",
  password: "password123"
};

const TEST_RUN_ID = Date.now();

const TEMP_ARTIST_NAME =
  `Automated Test Artist ${TEST_RUN_ID}`;

const TEMP_ARTIST_EDITED_NAME =
  `Automated Edited Artist ${TEST_RUN_ID}`;

const TEMP_VENUE_NAME =
  `Automated Test Venue ${TEST_RUN_ID}`;

const TEMP_VENUE_EDITED_NAME =
  `Automated Edited Venue ${TEST_RUN_ID}`;

const TEMP_VENUE_CITY = "Oxford";

const TEMP_VENUE_EDITED_CITY = "Cambridge";

const TEMP_GIG_TITLE =
  `Automated Test Gig ${TEST_RUN_ID}`;

const TEMP_GIG_EDITED_TITLE =
  `Automated Edited Gig ${TEST_RUN_ID}`;

const TEST_GIG_DATE = new Date(
  Date.now() + 90 * 24 * 60 * 60 * 1000
)
  .toISOString()
  .slice(0, 10);

let passed = 0;
let failed = 0;

let testCookie = "";
let secondCookie = "";

let testUserGigs = [];
let secondUserGigs = [];

let tempArtistId = null;
let tempVenueId = null;
let tempGigId = null;

function getCookie(response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    return "";
  }

  return setCookie.split(";")[0];
}

async function login(email, password) {
  const body = new URLSearchParams({
    email,
    password
  });

  const response = await fetch(
    `${BASE_URL}/login`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body,
      redirect: "manual"
    }
  );

  return {
    response,
    cookie: getCookie(response)
  };
}

async function request(
  path,
  {
    method = "GET",
    cookie = "",
    body = null
  } = {}
) {
  const options = {
    method,
    redirect: "manual",
    headers: {}
  };

  if (cookie) {
    options.headers.Cookie = cookie;
  }

  if (body) {
    options.headers["Content-Type"] =
      "application/x-www-form-urlencoded";

    options.body = new URLSearchParams(body);
  }

  return fetch(`${BASE_URL}${path}`, options);
}

async function runTest(name, testFunction) {
  try {
    await testFunction();

    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL: ${name}`);
    console.log(`      ${error.message}`);
  }
}

async function main() {
  console.log("");
  console.log(
    "GigTracker automated integration tests"
  );
  console.log(
    "--------------------------------------"
  );

  // --------------------------------------------------
  // ACCESS CONTROL AND SECURITY
  // --------------------------------------------------

  await runTest(
    "Logged-out API access returns JSON 401",
    async () => {
      const response = await request("/api/gigs");

      assert.strictEqual(response.status, 401);

      const contentType =
        response.headers.get("content-type");

      assert.ok(
        contentType &&
        contentType.includes("application/json")
      );

      const data = await response.json();

      assert.strictEqual(
        data.error,
        "Authentication required."
      );
    }
  );

  await runTest(
    "Express technology header is hidden",
    async () => {
      const response = await request("/api/gigs");

      assert.strictEqual(
        response.headers.get("x-powered-by"),
        null
      );
    }
  );

  await runTest(
    "Logged-out private GET redirects to login",
    async () => {
      const response = await request("/gigs");

      assert.strictEqual(response.status, 302);

      assert.strictEqual(
        response.headers.get("location"),
        "/login"
      );
    }
  );

  await runTest(
    "Logged-out private POST is rejected",
    async () => {
      const response = await request(
        "/add-gig",
        {
          method: "POST",
          body: {
            title: "Should Not Work",
            artist: "Nobody",
            venue: "Nowhere",
            city: "Nowhere",
            gig_date: TEST_GIG_DATE,
            attendance_status: "Maybe"
          }
        }
      );

      assert.strictEqual(response.status, 401);
    }
  );

  // --------------------------------------------------
  // LOGIN AND SESSION TESTS
  // --------------------------------------------------

  await runTest(
    "Test User can log in",
    async () => {
      const result = await login(
        TEST_USER.email,
        TEST_USER.password
      );

      assert.strictEqual(
        result.response.status,
        302
      );

      assert.ok(result.cookie);

      testCookie = result.cookie;
    }
  );

  await runTest(
    "Second User can log in",
    async () => {
      const result = await login(
        SECOND_USER.email,
        SECOND_USER.password
      );

      assert.strictEqual(
        result.response.status,
        302
      );

      assert.ok(result.cookie);

      secondCookie = result.cookie;
    }
  );

  await runTest(
    "Wrong password is rejected",
    async () => {
      const result = await login(
        TEST_USER.email,
        "definitely-wrong-password"
      );

      assert.strictEqual(
        result.response.status,
        401
      );

      const text =
        await result.response.text();

      assert.strictEqual(
        text,
        "Incorrect email or password."
      );
    }
  );

  await runTest(
    "Unknown email is rejected",
    async () => {
      const result = await login(
        "does-not-exist@example.com",
        "password123"
      );

      assert.strictEqual(
        result.response.status,
        401
      );

      const text =
        await result.response.text();

      assert.strictEqual(
        text,
        "Incorrect email or password."
      );
    }
  );

  await runTest(
    "Session identifies the logged-in Test User",
    async () => {
      const response = await request(
        "/session-test",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const data = await response.json();

      assert.strictEqual(data.loggedIn, true);

      assert.strictEqual(
        data.user.email,
        TEST_USER.email
      );
    }
  );

  // --------------------------------------------------
  // REGISTRATION VALIDATION
  // --------------------------------------------------

  await runTest(
    "Invalid registration email is rejected",
    async () => {
      const response = await request(
        "/register",
        {
          method: "POST",
          body: {
            name: "Automated Invalid Email",
            email: "not-an-email",
            password: "password123",
            confirm_password: "password123"
          }
        }
      );

      assert.strictEqual(response.status, 400);

      const text = await response.text();

      assert.strictEqual(
        text,
        "Please enter a valid email address."
      );
    }
  );

  await runTest(
    "Short registration password is rejected",
    async () => {
      const response = await request(
        "/register",
        {
          method: "POST",
          body: {
            name: "Automated Short Password",
            email:
              `short-${TEST_RUN_ID}@example.com`,
            password: "short",
            confirm_password: "short"
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  await runTest(
    "Overlong registration password is rejected",
    async () => {
      const longPassword = "a".repeat(129);

      const response = await request(
        "/register",
        {
          method: "POST",
          body: {
            name: "Automated Long Password",
            email:
              `long-${TEST_RUN_ID}@example.com`,
            password: longPassword,
            confirm_password: longPassword
          }
        }
      );

      assert.strictEqual(response.status, 400);

      const text = await response.text();

      assert.strictEqual(
        text,
        "Password must be 128 characters or fewer."
      );
    }
  );

  await runTest(
    "Mismatched registration passwords are rejected",
    async () => {
      const response = await request(
        "/register",
        {
          method: "POST",
          body: {
            name: "Automated Mismatch",
            email:
              `mismatch-${TEST_RUN_ID}@example.com`,
            password: "password123",
            confirm_password: "password456"
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  // --------------------------------------------------
  // EXISTING USER DATA AND OWNERSHIP
  // --------------------------------------------------

  await runTest(
    "Test User API returns Test User gigs",
    async () => {
      const response = await request(
        "/api/gigs",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      testUserGigs = await response.json();

      assert.ok(Array.isArray(testUserGigs));

      assert.ok(
        testUserGigs.length > 0,
        "Test User needs at least one gig."
      );
    }
  );

  await runTest(
    "Second User API returns Second User gigs",
    async () => {
      const response = await request(
        "/api/gigs",
        {
          cookie: secondCookie
        }
      );

      assert.strictEqual(response.status, 200);

      secondUserGigs = await response.json();

      assert.ok(Array.isArray(secondUserGigs));

      assert.ok(
        secondUserGigs.length > 0,
        "Second User needs at least one gig."
      );
    }
  );

  await runTest(
    "Different users do not share gig API results",
    async () => {
      const testIds = new Set(
        testUserGigs.map((gig) => gig.id)
      );

      for (const gig of secondUserGigs) {
        assert.strictEqual(
          testIds.has(gig.id),
          false,
          "A gig appeared for both users."
        );
      }
    }
  );

  await runTest(
    "Test User cannot open Second User gig",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/edit-gig/${secondGig.id}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot edit Second User gig",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/edit-gig/${secondGig.id}`,
        {
          method: "POST",
          cookie: testCookie,
          body: {
            title: "Unauthorised Edit",
            artist: secondGig.artist_name,
            venue: secondGig.venue_name,
            city: secondGig.venue_city,
            gig_date: secondGig.gig_date,
            ticket_url:
              secondGig.ticket_url || "",
            attendance_status:
              secondGig.attendance_status ||
              "Maybe",
            notes: "Should not work"
          }
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot delete Second User gig",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/delete-gig/${secondGig.id}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot open Second User artist",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/edit-artist/${secondGig.artist_id}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot edit Second User artist",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/edit-artist/${secondGig.artist_id}`,
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: "AUTOMATED HACK TEST"
          }
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot delete Second User artist",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/delete-artist/${secondGig.artist_id}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot open Second User venue",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/edit-venue/${secondGig.venue_id}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot edit Second User venue",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/edit-venue/${secondGig.venue_id}`,
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: "AUTOMATED HACK VENUE",
            city: "AUTOMATED HACK CITY"
          }
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User cannot delete Second User venue",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/delete-venue/${secondGig.venue_id}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Second User records remain unchanged",
    async () => {
      const originalGig = secondUserGigs[0];

      const response = await request(
        "/api/gigs",
        {
          cookie: secondCookie
        }
      );

      const gigs = await response.json();

      const currentGig = gigs.find(
        (gig) => gig.id === originalGig.id
      );

      assert.ok(currentGig);

      assert.strictEqual(
        currentGig.title,
        originalGig.title
      );

      assert.strictEqual(
        currentGig.artist_name,
        originalGig.artist_name
      );

      assert.strictEqual(
        currentGig.venue_name,
        originalGig.venue_name
      );
    }
  );

  // --------------------------------------------------
  // CALENDAR EXPORT
  // --------------------------------------------------

  await runTest(
    "Own gig can be exported as a calendar file",
    async () => {
      const ownGig = testUserGigs[0];

      const response = await request(
        `/export-gig/${ownGig.id}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const contentType =
        response.headers.get("content-type");

      assert.ok(
        contentType &&
        contentType.includes("text/calendar")
      );

      const calendar = await response.text();

      assert.ok(
        calendar.includes("BEGIN:VCALENDAR")
      );

      assert.ok(
        calendar.includes("BEGIN:VEVENT")
      );

      assert.ok(
        calendar.includes("END:VCALENDAR")
      );
    }
  );

  await runTest(
    "Another user's calendar export is blocked",
    async () => {
      const secondGig = secondUserGigs[0];

      const response = await request(
        `/export-gig/${secondGig.id}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  // --------------------------------------------------
  // ARTIST CRUD
  // --------------------------------------------------

  await runTest(
    "Test User can create an artist",
    async () => {
      const response = await request(
        "/add-artist",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: TEMP_ARTIST_NAME
          }
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/artists",
        {
          cookie: testCookie
        }
      );

      const artists = await apiResponse.json();

      const artist = artists.find(
        (item) =>
          item.name === TEMP_ARTIST_NAME
      );

      assert.ok(artist);

      tempArtistId = artist.id;
    }
  );

  await runTest(
    "Duplicate artist is rejected",
    async () => {
      const response = await request(
        "/add-artist",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: TEMP_ARTIST_NAME
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  await runTest(
    "Test User can edit own artist",
    async () => {
      const response = await request(
        `/edit-artist/${tempArtistId}`,
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: TEMP_ARTIST_EDITED_NAME
          }
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/artists",
        {
          cookie: testCookie
        }
      );

      const artists = await apiResponse.json();

      const artist = artists.find(
        (item) => item.id === tempArtistId
      );

      assert.ok(artist);

      assert.strictEqual(
        artist.name,
        TEMP_ARTIST_EDITED_NAME
      );
    }
  );

  // --------------------------------------------------
  // VENUE CRUD
  // --------------------------------------------------

  await runTest(
    "Test User can create a venue",
    async () => {
      const response = await request(
        "/add-venue",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: TEMP_VENUE_NAME,
            city: TEMP_VENUE_CITY
          }
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/venues",
        {
          cookie: testCookie
        }
      );

      const venues = await apiResponse.json();

      const venue = venues.find(
        (item) =>
          item.name === TEMP_VENUE_NAME &&
          item.city === TEMP_VENUE_CITY
      );

      assert.ok(venue);

      tempVenueId = venue.id;
    }
  );

  await runTest(
    "Duplicate venue is rejected",
    async () => {
      const response = await request(
        "/add-venue",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: TEMP_VENUE_NAME,
            city: TEMP_VENUE_CITY
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  await runTest(
    "Test User can edit own venue",
    async () => {
      const response = await request(
        `/edit-venue/${tempVenueId}`,
        {
          method: "POST",
          cookie: testCookie,
          body: {
            name: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY
          }
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/venues",
        {
          cookie: testCookie
        }
      );

      const venues = await apiResponse.json();

      const venue = venues.find(
        (item) => item.id === tempVenueId
      );

      assert.ok(venue);

      assert.strictEqual(
        venue.name,
        TEMP_VENUE_EDITED_NAME
      );

      assert.strictEqual(
        venue.city,
        TEMP_VENUE_EDITED_CITY
      );
    }
  );

  // --------------------------------------------------
  // FOLLOW / UNFOLLOW
  // --------------------------------------------------

  await runTest(
    "Test User can follow an artist",
    async () => {
      const response = await request(
        `/follow-artist/${tempArtistId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/artists",
        {
          cookie: testCookie
        }
      );

      const artists = await apiResponse.json();

      const artist = artists.find(
        (item) => item.id === tempArtistId
      );

      assert.ok(artist);

      assert.strictEqual(
        artist.is_followed,
        1
      );
    }
  );

  await runTest(
    "Artist follow is user-specific",
    async () => {
      const response = await request(
        "/api/artists",
        {
          cookie: secondCookie
        }
      );

      const artists = await response.json();

      const artist = artists.find(
        (item) => item.id === tempArtistId
      );

      assert.ok(artist);

      assert.strictEqual(
        artist.is_followed,
        0
      );
    }
  );

  await runTest(
    "Test User can follow a venue",
    async () => {
      const response = await request(
        `/follow-venue/${tempVenueId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/venues",
        {
          cookie: testCookie
        }
      );

      const venues = await apiResponse.json();

      const venue = venues.find(
        (item) => item.id === tempVenueId
      );

      assert.ok(venue);

      assert.strictEqual(
        venue.is_followed,
        1
      );
    }
  );

  await runTest(
    "Venue follow is user-specific",
    async () => {
      const response = await request(
        "/api/venues",
        {
          cookie: secondCookie
        }
      );

      const venues = await response.json();

      const venue = venues.find(
        (item) => item.id === tempVenueId
      );

      assert.ok(venue);

      assert.strictEqual(
        venue.is_followed,
        0
      );
    }
  );

  // --------------------------------------------------
  // GIG VALIDATION
  // --------------------------------------------------

  await runTest(
    "Missing required gig fields are rejected",
    async () => {
      const response = await request(
        "/add-gig",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            title: "",
            artist: TEMP_ARTIST_EDITED_NAME,
            venue: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY,
            gig_date: TEST_GIG_DATE,
            attendance_status: "Maybe"
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  await runTest(
    "Invalid attendance status is rejected",
    async () => {
      const response = await request(
        "/add-gig",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            title:
              `Invalid Attendance ${TEST_RUN_ID}`,
            artist: TEMP_ARTIST_EDITED_NAME,
            venue: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY,
            gig_date: TEST_GIG_DATE,
            attendance_status: "Definitely"
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  await runTest(
    "Invalid ticket URL is rejected",
    async () => {
      const response = await request(
        "/add-gig",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            title:
              `Invalid URL Gig ${TEST_RUN_ID}`,
            artist: TEMP_ARTIST_EDITED_NAME,
            venue: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY,
            gig_date: TEST_GIG_DATE,
            ticket_url:
              "javascript:alert(1)",
            attendance_status: "Going",
            notes: "Should not be created"
          }
        }
      );

      assert.strictEqual(response.status, 400);
    }
  );

  // --------------------------------------------------
  // GIG CREATE / READ
  // --------------------------------------------------

  await runTest(
    "Test User can create a gig",
    async () => {
      const response = await request(
        "/add-gig",
        {
          method: "POST",
          cookie: testCookie,
          body: {
            title: TEMP_GIG_TITLE,
            artist: TEMP_ARTIST_EDITED_NAME,
            venue: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY,
            gig_date: TEST_GIG_DATE,
            ticket_url:
              "https://example.com/tickets",
            attendance_status: "Maybe",
            notes:
              '<script>alert("integration-test")</script>'
          }
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/gigs",
        {
          cookie: testCookie
        }
      );

      const gigs = await apiResponse.json();

      const gig = gigs.find(
        (item) =>
          item.title === TEMP_GIG_TITLE
      );

      assert.ok(gig);

      assert.strictEqual(
        gig.artist_name,
        TEMP_ARTIST_EDITED_NAME
      );

      assert.strictEqual(
        gig.venue_name,
        TEMP_VENUE_EDITED_NAME
      );

      assert.strictEqual(
        gig.venue_city,
        TEMP_VENUE_EDITED_CITY
      );

      assert.strictEqual(
        gig.attendance_status,
        "Maybe"
      );

      tempGigId = gig.id;
    }
  );

  await runTest(
    "New gig belongs only to Test User",
    async () => {
      const response = await request(
        "/api/gigs",
        {
          cookie: secondCookie
        }
      );

      const gigs = await response.json();

      assert.strictEqual(
        gigs.some(
          (gig) => gig.id === tempGigId
        ),
        false
      );
    }
  );

  await runTest(
    "Gig edit page escapes stored HTML",
    async () => {
      const response = await request(
        `/edit-gig/${tempGigId}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.strictEqual(
        html.includes(
          '<script>alert("integration-test")</script>'
        ),
        false
      );

      assert.ok(
        html.includes("&lt;script&gt;")
      );
    }
  );

  // --------------------------------------------------
  // SEARCH AND FILTERS
  // --------------------------------------------------

  await runTest(
    "Gig search finds the test gig",
    async () => {
      const response = await request(
        `/gigs?search=${encodeURIComponent(
          TEMP_GIG_TITLE
        )}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  await runTest(
    "City filter finds the test gig",
    async () => {
      const response = await request(
        `/gigs?city=${encodeURIComponent(
          TEMP_VENUE_EDITED_CITY
        )}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  await runTest(
    "Date range filter finds the test gig",
    async () => {
      const response = await request(
        `/gigs?date_from=${TEST_GIG_DATE}&date_to=${TEST_GIG_DATE}`,
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  await runTest(
    "Attendance filter finds Maybe gig",
    async () => {
      const response = await request(
        "/gigs?attendance=Maybe",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  await runTest(
    "Followed artist filter finds the test gig",
    async () => {
      const response = await request(
        "/gigs?followed_artists=1",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  await runTest(
    "Followed venue filter finds the test gig",
    async () => {
      const response = await request(
        "/gigs?followed_venues=1",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  // --------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------

  await runTest(
    "Dashboard shows the upcoming test gig",
    async () => {
      const response = await request(
        "/dashboard",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_TITLE)
      );
    }
  );

  // --------------------------------------------------
  // GIG EDIT
  // --------------------------------------------------

  await runTest(
    "Second User cannot edit Test User test gig",
    async () => {
      const response = await request(
        `/edit-gig/${tempGigId}`,
        {
          method: "POST",
          cookie: secondCookie,
          body: {
            title: "Second User Hack",
            artist: TEMP_ARTIST_EDITED_NAME,
            venue: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY,
            gig_date: TEST_GIG_DATE,
            ticket_url: "",
            attendance_status: "Going",
            notes: "Should not work"
          }
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Second User cannot delete Test User test gig",
    async () => {
      const response = await request(
        `/delete-gig/${tempGigId}`,
        {
          method: "POST",
          cookie: secondCookie
        }
      );

      assert.strictEqual(response.status, 404);
    }
  );

  await runTest(
    "Test User can edit a gig and attendance",
    async () => {
      const response = await request(
        `/edit-gig/${tempGigId}`,
        {
          method: "POST",
          cookie: testCookie,
          body: {
            title: TEMP_GIG_EDITED_TITLE,
            artist: TEMP_ARTIST_EDITED_NAME,
            venue: TEMP_VENUE_EDITED_NAME,
            city: TEMP_VENUE_EDITED_CITY,
            gig_date: TEST_GIG_DATE,
            ticket_url:
              "https://example.com/edited",
            attendance_status: "Went",
            notes:
              "Edited by automated integration test"
          }
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/gigs",
        {
          cookie: testCookie
        }
      );

      const gigs = await apiResponse.json();

      const gig = gigs.find(
        (item) => item.id === tempGigId
      );

      assert.ok(gig);

      assert.strictEqual(
        gig.title,
        TEMP_GIG_EDITED_TITLE
      );

      assert.strictEqual(
        gig.attendance_status,
        "Went"
      );

      assert.strictEqual(
        gig.notes,
        "Edited by automated integration test"
      );

      assert.strictEqual(
        gig.ticket_url,
        "https://example.com/edited"
      );
    }
  );

  await runTest(
    "Went attendance filter finds edited gig",
    async () => {
      const response = await request(
        "/gigs?attendance=Went",
        {
          cookie: testCookie
        }
      );

      const html = await response.text();

      assert.ok(
        html.includes(TEMP_GIG_EDITED_TITLE)
      );
    }
  );

  // --------------------------------------------------
  // UNFOLLOW
  // --------------------------------------------------

  await runTest(
    "Test User can unfollow an artist",
    async () => {
      const response = await request(
        `/unfollow-artist/${tempArtistId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/artists",
        {
          cookie: testCookie
        }
      );

      const artists = await apiResponse.json();

      const artist = artists.find(
        (item) => item.id === tempArtistId
      );

      assert.ok(artist);

      assert.strictEqual(
        artist.is_followed,
        0
      );
    }
  );

  await runTest(
    "Unfollowed artist filter excludes test gig",
    async () => {
      const response = await request(
        "/gigs?followed_artists=1",
        {
          cookie: testCookie
        }
      );

      const html = await response.text();

      assert.strictEqual(
        html.includes(TEMP_GIG_EDITED_TITLE),
        false
      );
    }
  );

  await runTest(
    "Test User can unfollow a venue",
    async () => {
      const response = await request(
        `/unfollow-venue/${tempVenueId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/venues",
        {
          cookie: testCookie
        }
      );

      const venues = await apiResponse.json();

      const venue = venues.find(
        (item) => item.id === tempVenueId
      );

      assert.ok(venue);

      assert.strictEqual(
        venue.is_followed,
        0
      );
    }
  );

  await runTest(
    "Unfollowed venue filter excludes test gig",
    async () => {
      const response = await request(
        "/gigs?followed_venues=1",
        {
          cookie: testCookie
        }
      );

      const html = await response.text();

      assert.strictEqual(
        html.includes(TEMP_GIG_EDITED_TITLE),
        false
      );
    }
  );

  // --------------------------------------------------
  // DELETE AND CLEANUP
  // --------------------------------------------------

  await runTest(
    "Test User can delete own gig",
    async () => {
      const response = await request(
        `/delete-gig/${tempGigId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/gigs",
        {
          cookie: testCookie
        }
      );

      const gigs = await apiResponse.json();

      assert.strictEqual(
        gigs.some(
          (item) => item.id === tempGigId
        ),
        false
      );
    }
  );

  await runTest(
    "Test User can delete own artist after gig removal",
    async () => {
      const response = await request(
        `/delete-artist/${tempArtistId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/artists",
        {
          cookie: testCookie
        }
      );

      const artists = await apiResponse.json();

      assert.strictEqual(
        artists.some(
          (item) => item.id === tempArtistId
        ),
        false
      );
    }
  );

  await runTest(
    "Test User can delete own venue after gig removal",
    async () => {
      const response = await request(
        `/delete-venue/${tempVenueId}`,
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(response.status, 302);

      const apiResponse = await request(
        "/api/venues",
        {
          cookie: testCookie
        }
      );

      const venues = await apiResponse.json();

      assert.strictEqual(
        venues.some(
          (item) => item.id === tempVenueId
        ),
        false
      );
    }
  );

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  await runTest(
    "Logout ends the Test User session",
    async () => {
      const logoutResponse = await request(
        "/logout",
        {
          method: "POST",
          cookie: testCookie
        }
      );

      assert.strictEqual(
        logoutResponse.status,
        302
      );

      const privateResponse = await request(
        "/gigs",
        {
          cookie: testCookie
        }
      );

      assert.strictEqual(
        privateResponse.status,
        302
      );

      assert.strictEqual(
        privateResponse.headers.get("location"),
        "/login"
      );
    }
  );

  await runTest(
    "Logging out Test User does not log out Second User",
    async () => {
      const response = await request(
        "/session-test",
        {
          cookie: secondCookie
        }
      );

      assert.strictEqual(response.status, 200);

      const data = await response.json();

      assert.strictEqual(data.loggedIn, true);

      assert.strictEqual(
        data.user.email,
        SECOND_USER.email
      );
    }
  );

  console.log("");
  console.log(
    "--------------------------------------"
  );

  console.log(
    `Tests complete: ${passed} passed, ${failed} failed`
  );

  console.log("");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "Test suite could not run:",
    error.message
  );

  process.exitCode = 1;
});