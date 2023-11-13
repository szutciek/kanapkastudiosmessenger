const Messenger = require('./backend/Messenger.js');
const { DataStorage } = require('./backend/UserData.js');


const app = Messenger.createServer();
const wss = Messenger.createWebsocketServer();
const UserDB = new DataStorage('./UserData/user.db');

Messenger.setGetRoute(app, '/', (req, res) => {
    res.render('pages/index');
});

Messenger.setGetRoute(app, '/chat/:chatid', (req, res) => {
    console.log(req.params.chatid);
    res.redirect('/chat');
});

Messenger.setGetRoute(app, '/chat', (req, res) => {
    res.render('pages/chat');
});

Messenger.setGetRoute(app, '/profile', (req, res) => {
    if (req.session.user !== undefined) {
        res.render('pages/profile', { username: req.session.user.username });
    }
    else res.redirect('/');
});

Messenger.setGetRoute(app, '/logout', (req, res) => {
    req.session.user = undefined;
    res.redirect('/');
})

Messenger.setGetRoute(app, '/login', (req, res) => {
    const data = { message: "pending", error: "none" };
    if (req.session.user !== undefined) {
        data.message = "logged in";
        data.username = req.session.user.username;
        res.redirect('/profile');
    }
    else res.render('pages/login', data);
});

Messenger.setPostRoute(app, '/login', async (req, res) => {

    const error = (msg) => {
        console.log(msg);
        res.send({ error: msg });
    }

    const session_login_attempt = () => {
        if (req.session.loginAttempt === undefined) req.session.loginAttempt = 1;
        else if (req.session.loginAttempt > 6) return error("Too many failed login attempts. Try again later.");
        else req.session.loginAttempt++;
        req.session.save();
        console.log(req.session.loginAttempt);
    }

    const verify_input = () => {
        if (req.body === undefined) return error("Missing body");
        if (!UserDB.verifyInput(req.body.username, req.body.password)) return error("Fuck off. Actually just get the fuck out of here fuckhead. Script kiddie");
    }

    const verify_if_user_exists = () => {
        UserDB.getUserData(req.body.username).then(_user => {
            if (_user === null || _user === undefined) {
                error("User not found.");
                return;
            }

            verify_user_data(_user);
        });
    }

    const verify_user_data = (user) => {
        console.log("Verifying")
        UserDB.verifyUser(req.body.username, req.body.password).then(value => {
            if (value) {
                console.log("Verified");
                req.session.loginAttempt--;
                console.log(user);
                req.session.user = {
                    username: user.username,
                    score: user.score
                }
                req.session.save();
        
                const token = Messenger.uuid();
                UserDB.userLoggedIn(token, user.username);
        
                res.send({ message: "success", user_token: token, username: user.username });
            }
            else {
                console.log("wrong")
                return error("Wrong password.");
            }
        });
    }

    try {
        if (req.session.user === undefined) {
            session_login_attempt();
            verify_input();
            verify_if_user_exists();
        }
    } catch (e) {
        console.log(e);
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