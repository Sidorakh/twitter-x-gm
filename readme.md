# oauth.gml

Add OAuth login functionality to your GMS2 games!

Pre-requisites:
 - Node.js v10 (later versions may work)
 - NPM 
 - An application registered with a supported OAuth provider

Suported prviders
 - Twitter
 - Google
 - Discord
 - Github
 - Facebook
 - Reddit


Dependencies:
 - express
 - body-parser
 - cookie-parser
 - uuid
 - express-session
 - inspect
 - oauth
 - sqlite3
 - request-promise
 - axios

Steps to run

1. Clone the repository to your PC and enter the folder
2. Copy the file `.env.example` and call it `.env`
3. Open the newly created `.env` file, and fill in the client and secret keys for the services you will be using
4. In `app.js`, comment out any of the services you don't require (ensure you comment out both the `require` and `app.use` calls)
    - For example, to remove Google OAuth, both the `const google = new (require('./routes/google.js'))(dbh);` and `app.use('/google',google.get_router());` lines should be commented out.
5. Replace the EXPRESS_SECRET value with a random string of characters 
6. Run `npm i` in the directory to install all dependencies
7. Start the server with `npm start` or `node app`


Provider OAuth documentation:
 - [Twitter](https://developer.twitter.com/en/docs/basics/authentication/overview/oauth)
 - [Google](https://developers.google.com/identity/protocols/OAuth2)
 - [Discord](https://discordapp.com/developers/docs/topics/oauth2)
 - [Github](https://developer.github.com/apps/building-oauth-apps/)
 - [Facebook](https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow/)
 - [Reddit](https://github.com/reddit-archive/reddit/wiki/oauth2-quick-start-example)