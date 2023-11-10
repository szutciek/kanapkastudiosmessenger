const Messenger = require('./backend/Messenger.js');
const { DataStorage } = require('./backend/UserData.js');

const app = Messenger.createServer();
const wss = Messenger.createWebsocketServer();
const UserDB = new DataStorage('./UserData/user.db');

Messenger.setGetRoute(app, '/', (req, res) => {
    res.render('pages/index');
});

Messenger.setGetRoute(app, '/login', (req, res) => {
    const data = { message: "pending", error: "none" };
    if (req.session.user !== undefined) {
        data.message = "logged in";
        data.username = req.session.user.username;
    }
    res.render('pages/login', data);
});

Messenger.setPostRoute(app, '/login', (req, res) => {
    const error = (msg) => {
        console.log(msg);
        res.render('pages/login', { message: "pending", error: msg });
    }

    if (req.session.loginAttempt === undefined) req.session.loginAttempt = 1;
    else if (req.session.loginAttempt > 6) return error("Too many failed login attempts. Try again later.");
    else req.session.loginAttempt++;

    if (req.body === undefined) return error("Missing body");
    if (!UserDB.verifyInput(req.body.username, req.body.password)) return error("Fuck off. Actually just get the fuck out of here fuckhead. Script kiddie");
    if (UserDB.getUserData(req.body.username) === null) {
        error("User not found.");
        return;
    }

    if (UserDB.verifyUser(req.body.username, req.body.password)) {
        req.session.loginAttempt--;

        const user = UserDB.getUserData(req.body.username);

        req.session.user = {
            username: user.username,
            score: user.score
        }

        const token = Messenger.uuid();
        UserDB.userLoggedIn(token, user.username);

        res.render("pages/login", { message: "success", user_token: token, username: user.username });
    }
    else {
        return error("Wrong password.");
    }
});

wss.addMessageHandler("message", (ws, json, req) => {
    UserDB.userMessage(wss.getLinkedConnection(ws).username, json.chat_id, json.message);
});

wss.addMessageHandler("link", (ws, json, req) => {
    if (json.user_token !== undefined) {
        const username = UserDB.getLoggedInUser(json.user_token);
        if (username === undefined) return;
        wss.linkWebsocketConnection(ws, json.user_token, username);
        console.log("Linked websocket to user.");
    }
});

Messenger.setUses(app);