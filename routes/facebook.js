const express = require('express');
const uuidv4 = require('uuid/v4');
const rp = require('request-promise');
const qs = require('qs');
const crypto = require('crypto');
const axios = require('axios').default;
const session_keys = {};
const session_id = {};

const auth_url='https://www.facebook.com/v5.0/dialog/oauth'

function base64decode(data) {
    while (data.length % 4 !== 0){
        data += '=';
  }
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(data, 'base64').toString('utf-8');
}

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
                method:'get',
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
            const user_data = JSON.parse( await rp('https://graph.facebook.com/me',{
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
                const stmt = db.prepare(`SELECT * FROM FacebookData WHERE ID=(?)`);
                const record = await dbh.stmt_get(stmt,id);
                stmt.finalize();
                if (record) {
                    res.type('json').send({status:'complete',id:`${id}`,data:JSON.parse(record.Data)});
                } else {
                    res.type('json').send({status:'failed',reason:'User does not exist'});
                }
        
            }
        });
        router.post('/delete-callback',async (req,res)=>{
            const encoded_data = req.body.signed_request.split('.');
            const signature = encoded_data[0];
            const user_data = JSON.parse(base64decode(encoded_data[1]));

            console.log(user_data);

            if (!user_data.algorithm || user_data.algorithm.toUpperCase() != 'HMAC-SHA256') {
                //console.log(`Algorithm incorrect, got ${user_data.algorithm}, expecting HMAC-SHA256`);
                return res.json({status:'failure',reason:`Unknown algorithm: ${user_data.algorithm}, expected HMAC-SHA256`});
            }

            const expected_signature = crypto.createHmac('sha256',process.env.FACEBOOK_SECRET_ID)
                                                .update(encoded_data[1])
                                                .digest('base64')
                                                .replace(/\+/g, '-')
                                                .replace(/\//g, '_')
                                                .replace('=', '');
            //
            if (signature !== expected_signature) {
                //console.log(`Signature mismatch, got ${signature}, expected ${signature}`);
                return res.json({status:'failure'})
            }
            
            const user_id = user_data.user_id;
            try {
                const stmt = db.prepare(`DELETE FROM FacebookData WHERE ID=(?)`);
                await dbh.stmt_run(stmt,user_id);
                stmt.finalize();
                const uuid = uuidv4().replace(/-/g,'');
                const stmt_record = db.prepare(`INSERT INTO FacebookDeletions (ID,Status) VALUES(?,?)`);
                await dbh.stmt_run(stmt_record,uuid,'Deletion successful');
                stmt_record.finalize();
                //console.log(`Deleted record ${user_id} and recorded as ${uuid}`);
                res.json({
                    url:`https://oauth.redshirt.dev/facebook/delete-tracker?id=${uuid}`,
                    confirmation_code:uuid
                })
            } catch(e) {
                console.error(e);
            }


        });
        router.get('/delete-tracker',async (req,res)=>{
            const stmt = db.prepare(`SELECT * FROM FacebookDeletions WHERE ID=(?)`);
            const result = await dbh.stmt_get(stmt,req.query.id);
            res.json(result);
        })
    }
    get_router() {
        return this.router;
    }
}