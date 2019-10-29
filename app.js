require('dotenv').config();
const express = require('express');
const body_parser = require('body-parser');
const cookie_parser = require('cookie-parser');
const session = require('express-session');
const uuidv4 = require('uuid/v4');
const inspect = require('util-inspect');
const sqlite3 = require('sqlite3').verbose();
const oauth = require('oauth');
const database_helper = require('./database-helper.js');
const session_keys = {};
const session_id = {};


const db = new sqlite3.Database("twitter.db");
const dbh = new database_helper(db);
db.serialize(async ()=>{
    await dbh.run(`CREATE TABLE IF NOT EXISTS UserData (
        ID TEXT NOT NULL PRIMARY KEY,
        Data TEXT NOT NULL,
        AccessToken TEXT NOT NULL,
        AccessSecret TEXT NOT NULL
    )`);
})



const consumer = new oauth.OAuth(   "https://twitter.com/oauth/request_token",
                                    "https://twitter.com/oauth/access_token",
                                    process.env.TWITTER_CONSUMER_KEY,
                                    process.env.TWITTER_CONSUMER_SECRET,
                                    "1.0A",
                                    process.env.TWITTER_CALLBACK,
                                    "HMAC-SHA1");
//

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
app.get('/twitter/token',(req,res)=>{
    const token = uuidv4();
    session_keys[token] = true;    // this is checked for and removed when logged in
    session_id[token] = undefined;
    res.type('json').send({token:token});
});
app.get('/twitter/login',(req,res)=>{
    if (!req.query.token) {
        return res.type('text').send('Invalid token specified')
    }
    if (session_keys[req.query.token] != true) {
        return res.type('text').send('Invalid token specified')
    }
    consumer.getOAuthRequestToken((err,oauth_token,oauth_secret,result)=>{
        if (err) {
            console.error(err);
            return res.send("Error obtaining OAuth request token: " + inspect(err));
        }
        req.session.oauth_token = oauth_token;
        req.session.oauth_token_secret = oauth_secret;
        req.session.token = req.query.token;
        res.redirect("https://twitter.com/oauth/authorize?oauth_token="+req.session.oauth_token);
    });
});

app.get('/twitter/callback',(req,res)=>{
    consumer.getOAuthAccessToken(   req.session.oauth_token, req.session.oauth_token_secret, req.query.oauth_verifier,
                                    (err, oauth_access_token, oauth_access_secret, result)=>{
        //
        if (err) {
            console.error(err);
            return res.send('Error obtaining OAuth access token: ' + inspect(err));
        }
        req.session.oauth_access_token = oauth_access_token;
        req.session.oauth_access_secret = oauth_access_secret;

        consumer.get("https://api.twitter.com/1.1/account/verify_credentials.json",
                        req.session.oauth_access_token, req.session.oauth_access_secret, async (error, data, response) =>{
            if (err) {
                console.error(err);
                return res.type('text').send(err);
            }
            const json = JSON.parse(data);
            console.log(`Token: ${req.session.token}`);
            const stmt = db.prepare(`SELECT * FROM UserData WHERE ID=(?)`);
            const stmt_results = await dbh.stmt_all(stmt,json.id_str);
            if (stmt_results.length > 0) {
                const stmt_update = db.prepare(`UPDATE UserData SET Data=(?),AccessToken=(?),AccessSecret=(?) WHERE ID=(?)`);
                await dbh.stmt_run(stmt_update,data,req.session.oauth_access_token,req.session.oauth_access_secret,json.id_str);
            } else {
                const stmt_insert = db.prepare(`INSERT INTO UserData (ID,Data,AccessToken,AccessSecret) VALUES (?,?,?,?)`);
                await dbh.stmt_run(stmt_insert,json.id_str,data,req.session.oauth_access_token,req.session.oauth_access_secret);
            }
            session_id[req.session.token] = json.id_str;
            res.type('text').send(`Welcome to <GAME NAME>, ${json.name} (${json.screen_name}). You can close this webpage now. `);
        });
    })
});

app.get('/twitter/check-token',async (req,res)=>{
    const id = session_id[req.query.token];
    if (id == undefined) {
        res.type('json').send({status:'wait'});
    } else {
        const stmt = db.prepare(`SELECT * FROM UserData WHERE ID=(?)`);
        const record = await dbh.stmt_get(stmt,id);
        if (record) {

            res.type('json').send({status:'complete',id:id});
        } else {
            res.type('json').send({status:'failed',reason:'User does not exist'});
        }

    }
});

app.listen(process.env.PORT);