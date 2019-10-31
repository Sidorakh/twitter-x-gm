const express = require('express');
const uuidv4 = require('uuid/v4');
const rp = require('request-promise');
const qs = require('qs');
const axios = require('axios').default;
const session_keys = {};
const session_id = {};

const auth_url='https://www.facebook.com/v5.0/dialog/oauth'


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
            
            const url = `${auth_url}?client_id=${process.env.FACEBOOK_CLIENT_ID}`
                        + `&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_CALLBACK)}`
                        + `&scope=public_profile`
                        + `&state=${req.query.token}`;

            res.redirect(url);

        });
        router.get('/callback',async (req,res)=>{
            if (req.session.token != req.query.state) {
                return res.type('text').send('Authentication failed - invalid state parameter');
            }
            const user_auth = JSON.parse(await rp('https://graph.facebook.com/v5.0/oauth/access_token',{
                method:'post',
                form:{
                    client_id:process.env.FACEBOOK_CLIENT_ID,
                    client_secret:process.env.FACEBOOK_SECRET_ID,
                    redirect_uri: process.env.FACEBOOK_CALLBACK,
                    code:req.query.code,
                    grant_type:'authorization_code',
                    scopes:'public_profile'
                },
                headers:{
                    'Accept':'application/json',
                    'User-Agent':process.env.APPLICATION_USER_AGENT
                }
            }));
            const user_data = JSON.parse( await rp('https://graph.facebook.com//me',{
                qs:{
                    fields:'id,name,picture',
                    access_token:user_auth.access_token
                }
            }));

            //*/


            const stmt = db.prepare(`SELECT * FROM FacebookData WHERE ID=(?)`);
            const stmt_results = await dbh.stmt_all(stmt,user_data.id);
            
            if (stmt_results.length > 0) {
                const stmt_update = db.prepare(`UPDATE FacebookData SET Data=(?) WHERE ID=(?)`);
                await dbh.stmt_run(stmt_update,JSON.stringify(user_data),user_data.id);
                stmt_update.finalize();
            } else {
                const stmt_insert = db.prepare(`INSERT INTO FacebookData (ID, Data) VALUES (?,?)`);
                await dbh.stmt_run(stmt_insert,user_data.id,JSON.stringify(user_data));
                stmt_insert.finalize();
            }

            session_id[req.session.token] = user_data.id;
            /**/
            //res.type('text').send('This was a triumph');

            res.type('text').send(`Welcome to <GAME NAME>, ${user_data.name}. You can close this webpage now. `);
        });
        router.get('/check-token',async (req,res)=>{
            const id = session_id[req.query.token];
            if (id == undefined) {
                res.type('json').send({status:'wait'});
            } else {
                const stmt = db.prepare(`SELECT * FROM GithubData WHERE ID=(?)`);
                const record = await dbh.stmt_get(stmt,id);
                stmt.finalize();
                if (record) {
                    res.type('json').send({status:'complete',id:`${id}`,data:JSON.parse(record.Data)});
                } else {
                    res.type('json').send({status:'failed',reason:'User does not exist'});
                }
        
            }
        });
        router.post('/delete-callback',(req,res)=>{

        });
        router.get('/delete-tracker',(req,res)=>{

        })
    }
    get_router() {
        return this.router;
    }
}