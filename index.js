import express from "express";
import bodyParser from "body-parser";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import methodOverride from"method-override";
import pg from "pg";
import env from "dotenv";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Constants 
const app = express();
const port = 3000;
// const saltRounds = 10;
// let adherent = false;
env.config();


// functions, middleware and setup
app.get('/favicon.ico', (req, res) => res.status(204).send());
app.use('/bootstrap', express.static(join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.set('views',join(__dirname + '/views'));


    // end of middleware



// database connection

const pool = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Test DB connection 
pool.connect()
  .then(client => {
    console.log('DB connection successful');
      client.release();
  })
  .catch(err => {
    console.error('DB connection failed: ', err.stack);
    console.error('Please check .env file and SQL server status')
    process.exit(1);
  });

pool.on('error', (err, client) => {
  console.error('Unexpected error on client', err.stack);
  if (client) {
    client.release();
  }else{
  process.exit(-1);
  }
});
console.log("DEBUG: Initializing Passport Local Strategy definition...");

// Routes 
app.get("/", (req, res) => {
    res.render('index')

  });

  // events routes
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

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });

  // logins, distribution of tickets, saving of customers records to validate tickets/entrance 
  

  // event list of object for demo purposes, will be replaced by database/REST API