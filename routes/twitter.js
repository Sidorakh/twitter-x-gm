const express = require('express');
const uuidv4 = require('uuid/v4');
const inspect = require('util-inspect');
const oauth = require('oauth');
const session_keys = {};
const session_id = {};
module.exports = class {
    constructor(dbh) {
        const consumer = new oauth.OAuth(   "https://twitter.com/oauth/request_token",
                                            "https://twitter.com/oauth/access_token",
                                            process.env.TWITTER_CONSUMER_KEY,
                                            process.env.TWITTER_CONSUMER_SECRET,
                                            "1.0A",
                                            process.env.TWITTER_CALLBACK,
                                            "HMAC-SHA1");

        //
        const router = express.Router();
        const db = dbh.get_db();
        this.router = router;
        router.get('/token',(req,res)=>{
            const token = uuidv4();
            session_keys[token] = true;
            session_id[token] = undefined;
            res.type('json').send({token:token});
        });
        router.get('/login',async (req,res)=>{
            if (!req.query.token) {
                return res.type('text').send('No token specified')
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
        router.get('/callback',async (req,res)=>{
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
                    const stmt = db.prepare(`SELECT * FROM TwitterData WHERE ID=(?)`);
                    const stmt_results = await dbh.stmt_all(stmt,json.id_str);
                    if (stmt_results.length > 0) {
                        const stmt_update = db.prepare(`UPDATE TwitterData SET Data=(?) WHERE ID=(?)`);
                        await dbh.stmt_run(stmt_update,data,json.id_str);
                    } else {
                        const stmt_insert = db.prepare(`INSERT INTO TwitterData (ID,Data) VALUES (?,?)`);
                        await dbh.stmt_run(stmt_insert,json.id_str,data);
                    }
                    session_id[req.session.token] = json.id_str;
                    res.type('text').send(`Welcome to <GAME NAME>, ${json.name} (${json.screen_name}). You can close this webpage now. `);
                });
            });
        });
        router.get('/check-token',async (req,res)=>{
            const id = session_id[req.query.token];
            if (id == undefined) {
                res.type('json').send({status:'wait'});
            } else {
                const stmt = db.prepare(`SELECT * FROM TwitterData WHERE ID=(?)`);
                const record = await dbh.stmt_get(stmt,id);
                if (record) {
                    res.type('json').send({status:'complete',id:id,data:JSON.parse(record.Data)});
                } else {
                    res.type('json').send({status:'failed',reason:'User does not exist'});
                }
        
            }
        });
    };
    get_router() {
        return this.router;
    }
}

