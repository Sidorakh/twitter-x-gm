# twitter-x-gm

Add Twitter login functionality to your GMS2 games!

Pre-requisites:
 - Node.js v10 (later versions may work)
 - A Twitter development account with an app
    - API consumer and secret keys for a Twitter application


Dependencies:
 - express
 - body-parser
 - cookie-parser
 - uuid
 - express-session
 - inspect
 - oauth
 - sqlite3

Steps to run

1. Clone the repository to your PC and enter the folder
2. Copy the file `.env.example` and call it `.env`
3. Open the newly created `.env` file, and fill in the Twitter consumer key and consumer secret with the same values from the Twitter developer console
4. Replace the EXPRESS_SECRET value with a random string
5. Run `npm i` in the directory to install all dependencies
6. Start the server with `npm start` or `node app`
