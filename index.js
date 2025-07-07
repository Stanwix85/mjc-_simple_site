import express from "express";
import bodyParser from "body-parser";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import methodOverride from"method-override";
import pg from "pg";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
// import { title } from "process";
import session from "express-session";
import env from "dotenv";
import { v4 as uuidv4 } from 'uuid';
// import bootstrap from "bootstrap";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Constants 
const app = express();
const port = 3000;
const saltRounds = 10;
let adherent = false;
env.config();

const Ad_Email_Mock = "member@example.com"
const Guest_Email_Mock = "guest@example.com"


// functions, middleware and setup
app.use('/bootstrap', express.static(join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.set('views',join(__dirname + '/views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: true, 
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
})
);

app.use(passport.initialize());
app.use(passport.session());

 app.use((req, res, next) => {
      if (!req.session.cart) {
        req.session.cart = [];
      }
      next();
    });

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
    passport.use(new LocalStrategy( 
      {
        usernameField: 'email', 
        passwordField: 'password',
        passReqToCallback: true
      },
      async (req, email, password, done) => {

        let isAdherent = false;
        try{
        if (email === Ad_Email_Mock) {
          isAdherent =  true;
        } else if (email === Guest_Email_Mock) {
          isAdherent = false;
        } else {
          isAdherent = false;
          console.log(`${email} is not a recognized member`)
        }
      } catch (error) {
        console.error("error during external verification (mock): ", error);
        isAdherent = false
      }
      // storing boolean--this will be used by deserializeUser
        // req.session.isAdherent = isAdherent;
      // guests will be given a unique ID

        const userId = isAdherent ? email : `guest-${uuidv4}`;
        const user = { id: userId, email: email, isAdherent: isAdherent };
         return done(null, user);
      
    }));

  // serialize and deserialize user
  passport.serializeUser((user, done) => {
    console.log(`Serializing user:  ${user.id}`)
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  let isAdherent = false;
  let email = id;
  if (id.startsWith('guest-')){
    isAdherent = false;
    email = 'guest@example.com'
  } else if (id === Ad_Email_Mock){
    isAdherent = true
  }
  const user = { id: id, email: email, isAdherent: isAdherent };
  done(null, { id: id, email: email, isAdherent: isAdherent } );
});


// Routes 
app.get("/", (req, res) => {
    console.log("--- Rendering Homepage (/) ---");
    console.log("req.isAuthenticated():", req.isAuthenticated());
    console.log("req.session.isAdherent:", req.session.isAdherent);
    console.log("req.user:", req.user); // This will show the id, email, and isAdherent from Passport
    console.log("--- End Rendering Homepage (/) ---");

    res.render('index', {
      isAuthenticated: req.isAuthenticated(),
      // isAdherent: req.user ? req.user.isAdherent : false,
      isAdherent: (req.user && req.user.hasOwnProperty('isAdherent')) ? req.user.isAdherent : (req.session.isAdherent || false),
      user: req.user || null,
      cart: req.session.cart
    });

  });

   // login routes
  app.post('/verify-email', (req, res, next) => {passport.authenticate('local', (err, user, info) => {
    if(err) { return next(err); }
    if(!user) {
      const guestUser = { id: `guest-${uuidv4()}`, email: Guest_Email_Mock, isAdherent: false };
      // req.session.isAdherent = false;
      req.logIn(guestUser, (err) => {
        if(err) { return next(err); }
        req.session.isAdherent = false;
      
      return res.redirect('/');
      });
      return
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      req.session.isAdherent = user.isAdherent;
      return res.redirect('/');
    });
    // req.session.isAdherent = user.isAdherent;
  })(req, res, next);
});

  app.post("/guest-login", (req, res, next) => {
    const guestUser = { id: `guest-${uuidv4()}`, email: Guest_Email_Mock, isAdherent: false};
    // req.session.isAdherent = guestUser.isAdherent
    req.logIn(guestUser, (err) => {
      if (err) { return next(err); }
      req.session.isAdherent = guestUser.isAdherent;

      return res.redirect("/")
    });
  });
  app.get("/login", (req, res) => {
  res.render('login', { message: req.flash('error') }); // Requires connect-flash if used
});

  // logout routes
  app.get('/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      req.session.destroy((err) => {
        if (err) { return next(err); }
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });
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
          showTypeDisplay: showTypeDisplay,
          isAuthenticated: req.isAuthenticated(),
          // isAdherent: req.user ? req.user.isAdherent : false,
          isAdherent: (req.user && req.user.hasOwnProperty('isAdherent')) ? req.user.isAdherent : (req.session.isAdherent || false),
          user: req.user || null,
          cart: req.session.cart || []

        });
      } catch (err) {
        console.error('Database query error:', err.stack);
        res.status(500).send('Error loading shows, Please try again later');
      }
    });

    // cart session
   
    app.post('/addToCart', (req, res) => {
      const itemId = req.body.itemId // event id 
      const quantity = parseInt(req.body.quantity || 1);
      if (itemId && quantity > 0) {
        const existingItemIndex = req.session.cart.findIndex(item => item.id === itemId);
        if (existingItemIndex > -1) {
          req.session.cart[existingItemIndex].quantity += quantity;
        } else {
          req.session.cart.push({ id: itemId, quantity: quantity, name: req.body.itemName || `Item ${itemId}` });
        }
        console.log('Cart updated', req.session.cart);
        res.json({ success: true, message: 'Item added to cart', cart: req.session.cart });
      } else {
         res.status(400).json({ success: false, message: 'Invalid item or quantity' });
      }
    });
    app.get("/cart", (req, res) => {
    res.render('cart', {
      cart: req.session.cart || [],
      isAuthenticated: req.isAuthenticated(),
      isAdherent: req.session.isAdherent || false

    });
  });
  // cart empty list 

  // get request for cart page
  // post, put, delete requests for cart
  // post request to change avaliable tickets


  // requests with stripe or banking npm package to handle payments


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });

  // logins, distribution of tickets, saving of customers records to validate tickets/entrance 
  

  // event list of object for demo purposes, will be replaced by database/REST API