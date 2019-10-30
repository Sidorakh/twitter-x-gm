require('dotenv').config();
const express = require('express');
const body_parser = require('body-parser');
const cookie_parser = require('cookie-parser');
const session = require('express-session');
const uuidv4 = require('uuid/v4');
const inspect = require('util-inspect');
const sqlite3 = require('sqlite3').verbose();
const database_helper = require('./database-helper.js');

const db = new sqlite3.Database("user_data.db");
const dbh = new database_helper(db);
db.serialize(async ()=>{
    
    await dbh.run(`CREATE TABLE IF NOT EXISTS TwitterData (
        ID TEXT NOT NULL PRIMARY KEY,
        Data TEXT NOT NULL
    )`);
    await dbh.run(`CREATE TABLE IF NOT EXISTS GoogleData (
        ID TEXT NOT NULL PRIMARY KEY,
        Data TEXT NOT NULL
    )`);
    await dbh.run(`CREATE TABLE IF NOT EXISTS DiscordData (
        ID TEXT NOT NULL PRIMARY KEY,
        Data TEXT NOT NULL
    )`);
    await dbh.run(`CREATE TABLE IF NOT EXISTS GithubData (
        ID TEXT NOT NULL PRIMARY KEY,
        Data TEXT NOT NULL
    )`);
    
});

const twitter = new (require('./routes/twitter.js'))(dbh);
const google = new (require('./routes/google.js'))(dbh);
const discord = new (require('./routes/discord.js'))(dbh);
const github = new (require('./routes/github.js'))(dbh);

const app = express();
app.use(body_parser.urlencoded({ extended: true }));
app.use(body_parser.json());
app.use(cookie_parser());
app.use(session({ secret: process.env.EXPRESS_SECRET, resave: false, saveUninitialized: true}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

app.get('/', (req,res)=>{
    res.type('text').send('Hello, world');
});

app.use('/twitter',twitter.get_router());
app.use('/google',google.get_router());
app.use('/discord',discord.get_router());
app.use('/github',github.get_router());


app.listen(process.env.PORT);