const express = require('express');
const uuidv4 = require('uuid/v4');
const axios = require('axios').default;
const rp = require('request-promise');
const atob = require('atob');
const session_keys = {};
const session_id = {};

const auth_url = 'https://discordapp.com/api/oauth2/authorize'
const token_url = 'https://discordapp.com/api/oauth2/token';
const revoke_url = 'https://discordapp.com/api/oauth2/token/revoke';
const data_url = 'https://discordapp.com/api/users/@me'

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
            
            const url = `${auth_url}?client_id=${process.env.DISCORD_CLIENT_ID}`
                      + `&redirect_uri=${encodeURIComponent(process.env.DISCORD_CALLBACK)}`
                      + `&response_type=code&scope=identify%20email`
                      + `&state=${req.query.token}`;
            res.redirect(url);
        });
        router.get('/callback',async (req,res)=>{
            if (req.session.token != req.query.state) {
                return res.type('text').send('Invalid state token received')
            }
            const user_auth = JSON.parse(await rp(token_url,{
                method:'post',
                form:{
                    client_id:process.env.DISCORD_CLIENT_ID,
                    client_secret:process.env.DISCORD_SECRET_ID,
                    redirect_uri: process.env.DISCORD_CALLBACK,
                    code:req.query.code,
                    grant_type:'authorization_code',
                    scopes:'identify email'
                },
                headers: {
                    'User-Agent':process.env.APPLICATION_USER_AGENT
                }
            }));
            
            const user_data = JSON.parse(await rp(`${data_url}`,{
                headers:{
                    'Authorization':`Bearer ${user_auth.access_token}`
                },
                method:'get'
            }));

            const stmt = db.prepare(`SELECT * FROM DiscordData WHERE ID=(?)`);
            const stmt_results = await dbh.stmt_all(stmt,user_data.id);

            if (stmt_results.length > 0) {
                const stmt_update = db.prepare(`UPDATE DiscordData SET Data=(?) WHERE ID=(?)`);
                await dbh.stmt_run(stmt_update,JSON.stringify(user_data),user_data.id);
            } else {
                const stmt_insert = db.prepare(`INSERT INTO DiscordData (ID, Data) VALUES (?,?)`);
                await dbh.stmt_run(stmt_insert,user_data.id,JSON.stringify(user_data));
            }

            session_id[req.session.token] = user_data.id;

            res.type('text').send(`Welcome to <GAME NAME>, ${user_data.username} (${user_data.email}). You can close this webpage now. `);
        });
        router.get('/check-token',async (req,res)=>{
            const id = session_id[req.query.token];
            if (id == undefined) {
                res.type('json').send({status:'wait'});
            } else {
                const stmt = db.prepare(`SELECT * FROM DiscordData WHERE ID=(?)`);
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

