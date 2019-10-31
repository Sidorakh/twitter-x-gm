const express = require('express');
const uuidv4 = require('uuid/v4');
const axios = require('axios').default;
const rp = require('request-promise');
const atob = require('atob');
//const FormData = require('form-data');
const session_keys = {};
const session_id = {};




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
            const openid_config = (await axios.get('https://accounts.google.com/.well-known/openid-configuration')).data;
            const auth_url = `${openid_config.authorization_endpoint}?client_id=${process.env.GOOGLE_CLIENT_ID}`
                        + `&response_type=code`
                        + `&scope=openid%20email%20profile`
                        + `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK)}`
                        + `&state=${req.query.token}`
                        + `&nonce=${uuidv4()}`;
            res.redirect(auth_url);
        });
        router.get('/callback',async (req,res)=>{
            if (req.session.token != req.query.state) {
                return res.type('text').send('Authentication failed - invalid state parameter');
            }
            const openid_config = (await axios.get('https://accounts.google.com/.well-known/openid-configuration')).data;
            
            //console.log(openid_config);
            // const form = new FormData();
            // form.append('code',req.query.code);
            // form.append('client_id',process.env.GOOGLE_CLIENT_ID);
            // form.append('client_secret',process.env.GOOGLE_SECRET_ID);
            // form.append('redirect_uri',process.env.GOOGLE_CALLBACK);
            // form.append('grant_type','authorization_code');
            
            
            //const token = await axios.post(openid_config.token_endpoint,form.getBuffer(),{headers:{'Content-Type':'application/x-www-form-urlencoded'}});
            //
            
            const token = JSON.parse(await rp(openid_config.token_endpoint,{form:{
                    code:req.query.code,
                    client_id:process.env.GOOGLE_CLIENT_ID,
                    client_secret:process.env.GOOGLE_SECRET_ID,
                    redirect_uri:process.env.GOOGLE_CALLBACK,
                    grant_type:'authorization_code',
                },
                method:'post',
                headers:{
                    Accept:'application/json'
                }
            }));

            let token_parts = token.id_token.split(/\./g);
            for (let i=0;i<token_parts.length;i++) {
                token_parts[i] = atob(token_parts[i]);
            }
            token_parts[0] = JSON.parse(token_parts[0]);
            token_parts[1] = JSON.parse(token_parts[1]);
            const user_data = token_parts[1];
            //console.log(token_parts);

            session_id[req.session.token] = user_data.sub;

            const stmt = db.prepare(`SELECT * FROM GoogleData WHERE ID=(?)`);
            const stmt_results = await dbh.stmt_all(stmt,user_data.sub);

            if (stmt_results.length > 0) {
                const stmt_update = db.prepare(`UPDATE GoogleData SET Data=(?) WHERE ID=(?)`);
                await dbh.stmt_run(stmt_update,JSON.stringify(user_data),user_data.sub);
            } else {
                const stmt_update = db.prepare(`INSERT INTO GoogleData (ID, Data) VALUES (?,?)`);
                await dbh.stmt_run(stmt_update,user_data.sub,JSON.stringify(user_data));
            }

            res.type('text').send(`Welcome to <GAME NAME>, ${user_data.name} (${user_data.email}). You can close this webpage now. `);
        });
        router.get('/check-token',async (req,res)=>{
            const id = session_id[req.query.token];
            if (id == undefined) {
                res.type('json').send({status:'wait'});
            } else {
                const stmt = db.prepare(`SELECT * FROM GoogleData WHERE ID=(?)`);
                const record = await dbh.stmt_get(stmt,id);
                if (record) {
                    res.type('json').send({status:'complete',id:id,data:JSON.parse(record.Data)});
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