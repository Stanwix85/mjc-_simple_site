import express from "express";
import bodyParser from "body-parser";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import methodOverride from"method-override";
import pg from "pg";
import passport from "passport";
import { Strategy } from "passport-local";
import { title } from "process";
import session from "express-session";
import env from "dotenv";
import { session } from "passport";
// import bootstrap from "bootstrap";
const __dirname = dirname(fileURLToPath(import.meta.url));

// constances 
const app = express();
const port = 3000;
const saltRounds = 10;
let adherent = false;
env.config();


// functions
app.use('/bootstrap', express.static(join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.set('views',join(__dirname + '/views'));

app.use(session({
  secret: "PASSSECRET",
  resave: false,
  saveUninitialized: true, 
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
  }
})
);

app.use(passport.initialize());
app.use(passport.session());
// database connection
const pool = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
pool.on('error', (err) => {
  console.error('Unexpected error on client');
  process.exit(-1);
});
// cart empty list 


app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.redirect('login');
  }
  });

  app.get("/cart", (req, res) => {
    res.render("cart")
  })
  // get request for cart page
  // post, put, delete requests for cart
  // post request to change avaliable tickets

    app.get("/events", async (req, res) => {
      let showType = req.query.type ? req.query.type.trim() : undefined;
        if (showType === 'undefined' || showType === '')
            showType = undefined;
          
      
      const minAgeParam = req.query.min_age ? parseInt(req.query.min_age) : undefined;
      const maxAgeParam = req.query.max_age ? parseInt(req.query.max_age) : undefined;


    // building query
          let queryText = 'SELECT * FROM events';
        const queryParams = [];
        let whereClauses = []
        let paramIndex = 1; 
      if (showType){
        whereClauses.push(`LOWER (events.show_type) = $${paramIndex}`);
        queryParams.push(showType.toLowerCase());
        paramIndex++
        console.log(`Filtering by showType: ${showType.toLowerCase()}`)
      } else {
        console.log("No specific show types requested")
      };


      if (minAgeParam !== undefined && !isNaN(minAgeParam) && minAgeParam >= 0) {
        whereClauses.push(`events.max_age >=$${paramIndex}`);
        queryParams.push(minAgeParam);
        paramIndex++;
    }
     if (maxAgeParam !== undefined && !isNaN(maxAgeParam) && maxAgeParam >= 0) {
        whereClauses.push(`events.min_age <= $${paramIndex}`);
        queryParams.push(maxAgeParam);
        paramIndex++;
    }
// combining where clause
    if (whereClauses.length > 0) {
      queryText += ' WHERE ' + whereClauses.join(' AND ');
    } else if (!showType && minAgeParam === undefined && maxAgeParam === undefined){
      console.log('NO filters applied, fetching all events')
    }

      queryText += ' ORDER BY date ASC, time ASC';
      console.log(queryText)
      console.log(queryParams)

      let shows = []
      try {
        const result = await pool.query(
        queryText, queryParams);
        shows = result.rows;

        let showTypeDisplay = "All";
        if (showType){
          showTypeDisplay = showType.charAt(0).toUpperCase() + showType.slice(1);
        } else if (maxAgeParam != undefined && !isNaN(minAgeParam) || maxAgeParam != undefined && !isNaN(maxAgeParam)) {
            showTypeDisplay = "Age-Filted Events";
        }

        res.render('events', {
          shows: shows, 
          showTypeDisplay: showTypeDisplay

        });
      } catch (err) {
        console.error('Database query error:', err.stack);
        res.status(500).send('Error loading shows, Please try again later');
      }
    });
  // get requests for each cases for the events page
  // get request for search cases


  // requests with stripe or banking npm package to handle payments
    passport.use(new Strategy( async function verify(email, adherent, cb){

    }));

  // serialize and deserialize user
  passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });

  // logins, distribution of tickets, saving of customers records to validate tickets/entrance 
  

  // event list of object for demo purposes, will be replaced by database/REST API