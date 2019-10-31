const express = require('express');
const uuidv4 = require('uuid/v4');
const rp = require('request-promise');
const qs = require('qs');
const axios = require('axios').default;
const session_keys = {};
const session_id = {};

const auth_url='https://www.reddit.com/api/v1/authorize'


module.exports = class {
    constructor(dbh) {

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
            req.session.token = req.query.token;
            
            const url = `${auth_url}`
                        + `?client_id=${process.env.REDDIT_CLIENT_ID}`
                        + `&redirect_uri=${encodeURIComponent(process.env.REDDIT_CALLBACK)}`
                        + `&scope=${encodeURIComponent('identity')}`
                        + `&state=${req.query.token}`
                        + `&response_type=code`
                        + `&duration=temporary`;

            res.redirect(url);

        });
        router.get('/callback',async (req,res)=>{
            if (req.session.token != req.query.state) {
                return res.type('text').send('Authentication failed - invalid state parameter');
            }
            /**/
            const user_auth = JSON.parse(await rp(`https://www.reddit.com/api/v1/access_token`,{
                method:'post',
                form:{
                    code:req.query.code,
                    grant_type:'authorization_code',
                    redirect_uri:process.env.REDDIT_CALLBACK,
                },
                auth:{
                    username:process.env.REDDIT_CLIENT_ID,
                    password:process.env.REDDIT_SECRET_ID
                },
                headers:{
                    'Accept':'application/json',
                    'User-Agent':process.env.APPLICATION_USER_AGENT
                }
            }));

            /**/
            const user_data = JSON.parse(await rp('https://oauth.reddit.com/api/v1/me',{
                method:'get',
                headers: {
                    'Authorization': `bearer ${user_auth.access_token}`,
                    'User-Agent':process.env.APPLICATION_USER_AGENT
                }
            }));

            /**/

            const stmt = db.prepare(`SELECT * FROM RedditData WHERE ID=(?)`);
            const stmt_results = await dbh.stmt_all(stmt,user_data.id);
            
            if (stmt_results.length > 0) {
                const stmt_update = db.prepare(`UPDATE RedditData SET Data=(?) WHERE ID=(?)`);
                await dbh.stmt_run(stmt_update,JSON.stringify(user_data),user_data.id);
            } else {
                const stmt_insert = db.prepare(`INSERT INTO RedditData (ID, Data) VALUES (?,?)`);
                await dbh.stmt_run(stmt_insert,user_data.id,JSON.stringify(user_data));
            }

            session_id[req.session.token] = user_data.id;

            /**/
            // res.json(user_data)
            // console.log(user_data);

            res.type('text').send(`Welcome to <GAME NAME>, ${user_data.name}. You can close this webpage now. `);
        });
        router.get('/check-token',async (req,res)=>{
            const id = session_id[req.query.token];
            if (id == undefined) {
                res.type('json').send({status:'wait'});
            } else {
                const stmt = db.prepare(`SELECT * FROM RedditData WHERE ID=(?)`);
                const record = await dbh.stmt_get(stmt,id);
                if (record) {
                    res.type('json').send({status:'complete',id:`${id}`,data:JSON.parse(record.Data)});
                } else {
                    res.type('json').send({status:'failed',reason:'User does not exist'});
                }
        
            }
        });
        
    }
    get_router() {
        return this.router;
    }
}