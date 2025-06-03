import express from "express";
import bodyParser from "body-parser";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import methodOverride from"method-override";
import { title } from "process";
// import bootstrap from "bootstrap";
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;
app.use('/bootstrap', express.static(join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use(express.static(join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
// cart empty list 


app.get("/", (req, res) => {

    res.render(__dirname + "/views/index.ejs");
  });
  // get request for cart page
  // post, put, delete requests for cart
  // post request to change avaliable tickets


  // get requests for each cases for the events page
  // get request for search cases


  // requests with stripe or banking npm package to handle payments


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });

  // logins, distribution of tickets, saving of customers records to validate tickets/entrance 
  

  // event list of object for demo purposes, will be replaced by database/REST API