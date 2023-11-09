const Messenger = require('./backend/Messenger.js');
const { DataStorage } = require('./backend/UserData.js');

const app = Messenger.createServer();
const wss = Messenger.createWebsocketServer();
const UserDB = new DataStorage('./UserData/user.db');

Messenger.setGetRoute(app, '/', (req, res) => {
    res.render('pages/index');
});

Messenger.setGetRoute(app, '/login', (req, res) => {
    const data = { message: "pending" };
    if (req.session.user !== null) {
        data.message = "logged in";
        data.username = req.session.user.username;
    }
    res.render('pages/login', data);
});

Messenger.setPostRoute(app, '/login', (req, res) => {
    const error = (msg) => {
        res.render('pages/login', { message: "pending", error: msg });
    }

    if (req.session.loginAttempt === undefined) req.session.loginAttempt = 1;
    else if (req.session.loginAttempt > 6) return error("Too many failed login attempts. Try again later.");
    else req.session.loginAttempt++;

    if (req.body === undefined) return error("Missing body");
    if (!UserDB.verifyInput(req.body.username, req.body.password)) return error("Fuck off. Actually just get the fuck out of here fuckhead. Script kiddie");
    if (UserDB.getUserData(req.body.username) === null) return error("User not found.");

    if (UserDB.verifyUser(req.body.username, req.body.password)) {
        req.session.loginAttempt--;

        // login the user aka get user data from db
        // and generate a volatile token.
    }
    else {
        return error("Wrong password.");
    }
});

wss.addMessageHandler("message", (ws, json, req) => {

});

Messenger.setUses(app);