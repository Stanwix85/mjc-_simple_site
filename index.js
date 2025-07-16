import express from "express";
import bodyParser from "body-parser";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import methodOverride from"method-override";
import pg from "pg";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import Stripe from "stripe";
import multer from "multer";
// import bootstrap from "bootstrap";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Constants 
const app = express();
const port = 3000;
// const saltRounds = 10;
// let adherent = false;
env.config();
const upload = multer();

const Ad_Email_Mock = "member@example.com";
const Guest_Email_Mock = "guest@example.com";
const TEMP_ADHERENT_PASSWORD = 'temp_password_for_adherent_check';


// functions, middleware and setup
app.get('/favicon.ico', (req, res) => res.status(204).send());
app.use('/bootstrap', express.static(join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.set('views',join(__dirname + '/views'));

function calculateCartTotalPrice(cart) {
  return cart.reduce((total, item) => total + (item.quantity * item.price), 0)
}

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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-06-30.basil'
    });

    function setupGuestSession(req, email) {
      req.session.isAdherent = false;
      req.session.userEmail = email;

      // res.json({
      //   succes: true,
      //   isAdherent: false,
      //   email: email,
      //   message: message || `Signed in as guest with email: ${email}`,
      //   redirectUrl: '/'
      // })
    }

    // ejs templates 
    app.use((req, res, next) => {
    res.locals.isAuthenticated = req.isAuthenticated ? req.isAuthenticated() : false;
    res.locals.isAdherent = req.session.isAdherent || false; // Pass adherent status
    res.locals.userEmail = req.session.userEmail || ''; // Pass user's email for pre-filling
    res.locals.cart = req.session.cart || []; // Pass cart data
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
console.log("DEBUG: Initializing Passport Local Strategy definition...");
passport.use(new LocalStrategy(
    {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    async (req, email, password, done) => { // Opening brace for async function
        console.log("!!!!! PASSPORT STRATEGY ASYNC FUNCTION ENTERED !!!!!");
        console.log("PASSPORT: Local Strategy callback triggered for email:", email);
        console.log("PASSPORT: Received password in strategy:", password);

        try {
            let isAdherent = false;
            let userId;
            let userEmailForDone = email; // Default userId for known emails

            if (email === Ad_Email_Mock && password === TEMP_ADHERENT_PASSWORD) {
                isAdherent = true;
                userId = email;
                console.log(`PASSPORT: ${email} recognized as Adherent. Authenticating.`);
            } else {
                isAdherent = false;

                try {
                userId = `guest-${uuidv4()}`; // Make sure uuidv4() is called as a function
                console.log("PASSPORT: uuidv4() called successfully. Generated userId:", userId);
                } catch (uuidError){
                  console.error("PASSPORT ERROR: Failed to generate UUID (likely uuidv4() issue):", uuidError);
                  return done(new Error("UUID generation failed. Check uuid import."));
                }
                if (!email || email.trim() === '') { // Explicitly check if email is empty or just whitespace
                    userEmailForDone = 'guest@example.com';
                    console.log(`PASSPORT: No valid email provided. Assigning default guest@example.com.`);
                } else {
                    userEmailForDone = email; // Use the entered email for guests
                    console.log(`PASSPORT: ${email} is not a recognized member. Treating as guest.`);
                }
            }

            const user = { id: userId, email: email, isAdherent: isAdherent };
            return done(null, user); // Call done() for success

        } catch (error) {
            console.error("error during external verification (mock): ", error);
            return done(error instanceof Error ? error : new Error(String(error))); // Call done() for error
        }
    } 
)); 
console.log("DEBUG: Passport Local Strategy definition complete.");

  // serialize and deserialize user
  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user); 
    if (user.isAdherent === false) { 
        console.log("Serializing guest user object.");
        done(null, user); 
    } else {
        console.log("Serializing adherent user ID:", user.id);
        done(null, user.id); 
    }
});

passport.deserializeUser((serializedData, done) => {
    console.log("Passport: deserializeUser received:", serializedData);

    if (typeof serializedData === 'object' && serializedData !== null && serializedData.isAdherent === false) {
        // This is a guest user object that was fully serialized
        console.log("PASSPORT: deserializeUser - Reconstructing guest user from object:", serializedData.email);
        return done(null, serializedData); // Return the object as is
    } else if (typeof serializedData === 'string' && serializedData === Ad_Email_Mock) {
        // This is an adherent user ID (the email itself)
        console.log("PASSPORT: deserializeUser - Reconstructing adherent user from ID:", serializedData);
        return done(null, { id: serializedData, email: serializedData, isAdherent: true });
    } else {
        console.log("PASSPORT: deserializeUser - Unknown/corrupted ID, treating as default guest.");
        return done(null, { id: `guest-${uuidv4()}`, email: 'guest@example.com', isAdherent: false });
    }
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
  app.post('/verify-email', upload.none(), (req, res, next) => {
     console.log("SERVER: === Entering /verify-email route ===");
    const email = req.body.email ? req.body.email.toLowerCase().trim(): '';
    const password =  req.body.password;
      console.log("SERVER: Received email:", email); 
    console.log("SERVER: Received password:", password);

    // if (!email) {
    //    const guestUser = { id: `guest-${uuidv4()}`, email: 'guest@example.com', isAdherent: false };
    //     req.logIn(guestUser, (err) => {
    //         if (err) { return next(err); }
    //         setupGuestSession(req, 'guest@example.com'); // Set session for guest
    //         console.log("Verify-Email: No email, logged in as default guest. req.session.isAdherent:", req.session.isAdherent);
    //         return res.json({
    //             success: true,
    //             isAdherent: false,
    //             email: 'guest@example.com',
    //             message: 'No email provided. Signed in as guest.',
    //             redirectUrl: '/'
    //                      });
    //     });
    //     return;
    // }
    
    passport.authenticate('local', {}, (authErr, user, info) => {
       console.log("SERVER: Passport authenticate callback for /verify-email fired."); // <--- NEW LOG
        console.log("SERVER: Passport err:", authErr); // <--- NEW LOG
        console.log("SERVER: Passport user:", user); // <--- NEW LOG
        console.log("SERVER: Passport info:", info); 

        if (authErr) {
            console.error("Passport authentication error:", authErr);
            // Treat as guest on server error
            const guestUser = { id: `guest-${uuidv4()}`, email: email || 'guest@example.com', isAdherent: false };
            req.logIn(guestUser, (err) => {
                if (err) { return next(err); }
                // setupGuestSession(req, guestUser.email); // Set session for guest
                // console.log("Verify-Email: Auth error, logged in as guest. req.session.isAdherent:", req.session.isAdherent);
                return res.status(500).json({ success: false, message: 'Authentication process failed due to server error.' });
            });
            return;
        }
     if (user && user.isAdherent) { // This user object has isAdherent: true
            console.log(`SERVER: User ${user.email} successfully authenticated as ADHERENT.`);
            req.logIn(user, (err) => {
                if (err) {
                    console.error("SERVER: Error during req.logIn for adherent user:", err);
                    return res.status(500).json({ success: false, message: 'Could not log in member after authentication.' });
                }
                req.session.isAdherent = true;
                req.session.userEmail = user.email;
                res.json({
                    success: true,
                    isAdherent: true,
                    email: user.email,
                    message: 'Logged in as adherent.', // Correct message for adherent
                    redirectUrl: '/'
                });
            });
        } else { // This block runs if !user (strategy returned false/null) OR if user.isAdherent is false
            console.log(`SERVER: Email '${email}' not recognized as adherent. Signing in as GUEST.`);
            // If 'user' is null (strategy returned done(null, false) or done(null, null)), create a new guestUser.
            // If 'user' is not null but isAdherent: false (our mock guest case), use that 'user' object.
            // const guestUser = user || { id: `guest-${uuidv4()}`, email: email, isAdherent: false }; // Ensure 'email' is the input email
            req.logIn(user, (err) => {
                if (err) {
                    console.error("SERVER: Error during req.logIn for guest user:", err);
                    return next(err);
                }
                setupGuestSession(req, user.email); // Sets req.session.isAdherent = false and userEmail to guestUser.email
                res.json({
                    success: true,
                    isAdherent: false,
                    email: user.email, // This will correctly be the entered email or `guest@example.com` from strategy
                    message: `Email '${email}' not recognized as member. Signed in as guest.`, // Correct message for guest
                    redirectUrl: '/'
                });
            });
        }
      })(req, res, next);

    
    });
    // req.session.isAdherent = user.isAdherent;

  app.post("/guest-login", upload.none(), (req, res, next) => {
    const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
    const finalEmail = email || 'guest@example.com'; 
    const guestUser = { id: `guest-${uuidv4()}`, email: finalEmail, isAdherent: false }; 
    // req.session.isAdherent = guestUser.isAdherent
      req.session.allowCheckout = (finalEmail !== 'guest@example.com');
    
    // handleGuestLogin(req, res, finalEmail, `Signed in as guest with email: ${finalEmail}`);
    req.logIn(guestUser, (err) => {
      if (err) { 
        console.error("Guest login error during req.login:", err);
        return res.status(500).json ({ success: false, message: 'Could not log in as guest'});
      }
      setupGuestSession(req, finalEmail);
      console.log('User logged in as guest:', guestUser.id, 'Email:', finalEmail);
      res.json ({
        success: true,
        isAdherent: false,
        email: finalEmail,
        message: `Signed in as guest with email: ${finalEmail}`,
        redirectUrl: '/'
      })
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
    app.get("/cart", (req, res) => {
    console.log("SERVER: Rendering cart page.");
    res.render('cart', {
        cart: req.session.cart || [],
        isAuthenticated: req.isAuthenticated(),
        isAdherent: req.session.isAdherent || false
    });
});
   
    app.post('/addToCart', upload.none(), (req, res) => {
    console.log("SERVER: Entering /addToCart route");

    if (!req.session.cart) {
        req.session.cart = [];
    }

  
    const itemId = req.body.itemId; 
    const itemName = req.body.itemName;
    const itemQuantity = parseInt(req.body.quantity || 1, 10); 
    const itemPrice = parseFloat(req.body.itemPrice); 
    const itemDate = req.body.itemDate; 
    const itemTime = req.body.itemTime; 

    // Basic validation
    if (!itemId || !itemName || isNaN(itemQuantity) || itemQuantity <= 0 || isNaN(itemPrice) || itemPrice <= 0 || !itemDate || !itemTime) {
        console.error("SERVER: Invalid data for adding to cart. Missing or invalid itemId, itemName, quantity, price, date, or time.");
        return res.status(400).json({ success: false, message: "Invalid item data provided." });
    }
    if (itemQuantity > 8) { // Prevent adding more than 8 at once
        return res.status(400).json({ success: false, message: "Cannot add more than 8 tickets at a time." });
    }

    console.log(`SERVER: Processing Add to Cart for: ${itemName} (ID: ${itemId}), Quantity: ${itemQuantity}, Price: ${itemPrice}, Date: ${itemDate}, Time: ${itemTime}`);

    const existingItemIndex = req.session.cart.findIndex(item => item.id === itemId);

    if (existingItemIndex > -1) {
        // Item already in cart, update quantity
        const currentItem = req.session.cart[existingItemIndex];
        const newTotalQuantity = currentItem.quantity + itemQuantity;

        if (newTotalQuantity > 8) {
            console.log(`SERVER: Limit of 8 tickets reached for ${itemName}. Current: ${currentItem.quantity}, Trying to add: ${itemQuantity}`);
            return res.status(400).json({ success: false, message: `You already have ${currentItem.quantity} tickets for ${itemName}. Cannot exceed 8 total.` });
        }

        req.session.cart[existingItemIndex].quantity = newTotalQuantity;
        // Also update other details in case they changed (e.g., price)
        req.session.cart[existingItemIndex].name = itemName;
        req.session.cart[existingItemIndex].price = itemPrice;
        req.session.cart[existingItemIndex].date = itemDate;
        req.session.cart[existingItemIndex].time = itemTime;

        console.log(`SERVER: Updated quantity for item ${itemName} (${itemId}) to ${newTotalQuantity}.`);

    } else {
        // Item not in cart, add as new item
        req.session.cart.push({
            id: itemId,
            name: itemName,
            quantity: itemQuantity,
            price: itemPrice,
            date: itemDate,
            time: itemTime
        });
        console.log(`SERVER: Added new item ${itemName} (${itemId}) to cart.`);
    }

    // After updating the cart, send a success response
    console.log("SERVER: Cart state after /addToCart:", req.session.cart);
    return res.json({
        success: true,
        message: `${itemName} added to your cart!`,
        cart: req.session.cart // Send back the full updated cart
    });
});

  // cart total logic 
  app.get('/getCartContents', (req,res) => {
    try{
      const cart = req.session.cart || [];
      res.json({ success: true, cart: cart });
    } catch (error) {
      console.error("error fetching cart contents", error);
      res.status(500).json({ success: false, message: "Failed to fetch cart."})
    }
  });

  // update cart 
  app.post('/updateCartQuantity', upload.none(), (req, res) => {
    console.log("SERVER: Entering /updateCartQuantity route");
    if (!req.session.cart) {
        req.session.cart = [];
    }

    const { itemId, changeType } = req.body; 
    console.log(`SERVER: Attempting to ${changeType} quantity for item ID: ${itemId}`);

    const itemIndex = req.session.cart.findIndex(item => item.id === itemId);

    if (itemIndex > -1) {
        const item = req.session.cart[itemIndex];
        let newQuantity = item.quantity;

        if (changeType === 'increase') {
            if (newQuantity < 8) { 
                newQuantity++;
            }
        } else if (changeType === 'decrease') {
            if (newQuantity > 0) { 
                newQuantity--;
            }
        }

        if (newQuantity === 0) {
            // If quantity becomes 0, remove the item
            req.session.cart.splice(itemIndex, 1);
            console.log(`SERVER: Item ${item.name} (${itemId}) removed from cart (quantity reached 0).`);
        } else {
            req.session.cart[itemIndex].quantity = newQuantity;
            console.log(`SERVER: Item ${item.name} (${itemId}) quantity updated to ${newQuantity}.`);
        }

        const newSubtotal = req.session.cart[itemIndex] ? req.session.cart[itemIndex].quantity * req.session.cart[itemIndex].price : 0;
        const newCartTotal = calculateCartTotalPrice(req.session.cart);

        return res.json({
            success: true,
            message: "Cart quantity updated.",
            cart: req.session.cart, 
            updatedItem: req.session.cart[itemIndex], 
            newQuantity: newQuantity,
            newSubtotal: newSubtotal,
            newCartTotal: newCartTotal,
            itemId: itemId 
        });

    } else {
        console.warn(`SERVER: Item ID ${itemId} not found in cart for quantity update.`);
        return res.status(404).json({ success: false, message: "Item not found in cart." });
    }
});


  // delete item from cart
  app.post('/deleteCartItem', upload.none(), (req, res) => {
    if (!req.session.cart) {
      req.session.cart = [];
      return res.status(404).json({success: false, message: "Cart already empty"})
    }

    const { itemId } = req.body;
    const initialLength = req.session.cart.length;
    req.session.cart = req.session.cart.filter(item => item.id !== itemId);

    const newLength = req.session.cart.length; 

    if (newLength < initialLength){
      const newCartTotal = calculateCartTotalPrice(req.session.cart);
      return res.json({
        success: true,
            message: "Item removed from cart.",
            cart: req.session.cart, 
            newCartTotal: newCartTotal
      });
    } else {
      console.warn(`SERVER: Item ID ${itemId} not found in cart for deletion.`);
        return res.status(404).json({ success: false, message: "Item not found in cart." });
    }
  })

  // stripe and checkout session
    app.post('/checkout', async (req, res) => {
      try {
        if (!req.session.cart || req.session.cart.length === 0){
          return res.status(400).json({ error: 'Cart is empty.'})
        }
        const lineItemsPromises = req.session.cart.map(async (cartItem) => {
          const queryResult = await pool.query('SELECT id, title, price, price_aderent FROM events WHERE id = $1', [cartItem.id]);
          const event = queryResult.rows[0];
          if (!event) {
            throw new Error(`Event with ID ${cartItem.id} not found`)
          }
                     const unitPrice = req.session.isAdherent ? event.price_adherent : event.price;

            return {
                price_data: {
                    currency: 'eur', // Or your desired currency
                    product_data: {
                        name: event.title,
                    },
                    unit_amount: Math.round(unitPrice * 100), // Price in cents
                },
                quantity: cartItem.quantity,
            };
        });

        const lineItems = await Promise.all(lineItemsPromises);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.YOUR_DOMAIN}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.YOUR_DOMAIN}/checkout-cancel`,
            // Optional: You can pass customer details if logged in
            // customer_email: req.user ? req.user.email : undefined,
            // metadata: { userId: req.user ? req.user.id : 'guest' } // Custom data for your records
        });

        res.json({ id: session.id }); // Send the session ID back to the client
    } catch (error) {
        console.error('Error creating Stripe Checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

// checkout database route
app.post('/checkout-process', async (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0){
    req.flash('error', 'your cart is empty. Please add items before checkout');
    return res.redirect('/cart');
  }
  let dbTransaction; 
  try {
    const cart = req.session.cart;
    const totalAmount = calculateCartTotalPrice(cart);
    const userId = req.session.userId || null;

    const orderResult = await new Promise((resolve, reject) => {
      setTimeout(()=> resolve({ orderId: Date.now()}), 50 ); 
    });
    const orderId = orderResult.orderId;
    const purchasedItems = [];
    for (const cartItem of cart) {
      const eventId = cartItem.id;
      const quantity = cartItem.quantity;
      const ticketPrice = cartItem.price;

      await new Promise((resolve, reject)=> {
        setTimeout(() => resolve(), 50);
      });
      const eventData = await new Promise ((resolve, reject) => {
        setTimeout(() => resolve({ places_available: 100}), 50)
      });
      const currentPlacesAvailable = eventData.places_available;
      if(currentPlacesAvailable < quantity) {
        throw new Error(`Not enough places available for event ${cartItem.name}`)
      };
      const newPlacesAvailable = currentPlacesAvailable - quantity;

      await new Promise((resolve, reject) => {
        setTimeout(() => resolve(), 50);
      });
      purchasedItems.push({
        name: cartItem.name,
        quantity: quantity,
        price: ticketPrice,
        subtotal: (quantity * ticketPrice).toFixed(2)
      });
    }
    req.session.cart = [];
    req.flash('success', 'Your order has been placed successfully!');
    res.render('confirmation', {
      orderId: orderId,
      totalAmount: totalAmount.toFixed(2),
      purchasedItems: purchasedItems,
      message: req.flash('success')
    });
  } catch (error) {
    console.error('Checkout process failed:', error);
    req.flash('error', `There was an error processing your order: ${error.message}`);
      res.redirect('/cart'); // Redirect back to cart or an error page
  }
});

app.get('/confirmation', (req, res) => {
  if (!req.session.lastOrderDetails) {
    return res.redirect('/');
  }
  res.render('confirmation', req.session.lastOrderDetails);
    delete req.session.lastOrderDetails; // Clear after rendering
})

// success page 
  app.get('/order_compleated', async (req, res) => {
    const sessionId = req.query.session_id;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      res.render('checkout-success', { message: 'Payment successful! Your tickets are on their way.', isAuthenticated: req.isAuthenticated(), isAdherent: req.session.isAdherent || false });
        } else {
            res.render('checkout-success', { message: 'Payment not confirmed or already processed.', isAuthenticated: req.isAuthenticated(), isAdherent: req.session.isAdherent || false });
        }
    } catch (error) {
        console.error('Error retrieving Stripe session:', error);
        res.status(500).render('checkout-error', { message: 'Error processing your payment. Please contact support.', isAuthenticated: req.isAuthenticated(), isAdherent: req.session.isAdherent || false });
    }
});
app.get('/checkout-cancel', (req, res) => {
    res.render('checkout-cancel', { message: 'Payment cancelled.', isAuthenticated: req.isAuthenticated(), isAdherent: req.session.isAdherent || false });
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