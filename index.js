const Messenger = require('./backend/Messenger.js');
const { DataStorage } = require('./backend/UserData.js');


const app = Messenger.createServer();
const wss = Messenger.createWebsocketServer();
const UserDB = new DataStorage('./UserData/user.db');

process.addListener('SIGINT', (signal) => {
    UserDB.cleanup();
    wss.WSS.close();
    process.exit();
})

Messenger.setGetRoute(app, '/', (req, res) => {
    res.render('pages/index');
});


Messenger.setGetRoute(app, '/chat/data', async (req, res) => {
    const sendError = (msg) => {
        console.log(msg);
        res.send({ error: msg });
    }

    if (req.session.user === undefined) return sendError("You must be logged in to receive chat information.");
    
    const perms = await UserDB.getUsersChats(req.session.user.username);
    if (perms !== undefined)
        res.send({ perms: perms });
    else sendError("Couldn't find chats...");
});

Messenger.setGetRoute(app, '/chat', (req, res) => {
    res.render('pages/chat', { isLoggedIn: req.session.user !== undefined });
});

Messenger.setPostRoute(app, '/chat/create', async (req, res) => {
    const sendError = (msg) => {
        console.log(msg);
        res.send({ error: msg });
    }

    if (req.session.user === undefined) return sendError("You must be logged in to create a new chat.");

    if (req.session.user.score == 0) return sendError("This feature is currently locked to administrators only.");

    if (req.body !== undefined) {
        console.log(req.body);
        if (req.body.chatname === undefined) return sendError("Chat name is missing...");
        if (req.body.chatname.length <= 3 && req.body.chatname.length >= 20) return sendError("Chat name is too long.");

        const chat = await UserDB.createChat(req.session.user.username, req.body.chatname);
        if (chat) {
            res.send({ chat_id: chat[0], chatname: chat[1] });
            console.log(chat);
        }
        else sendError("Internal error when creating a chat.");
    }
});

Messenger.setPostRoute(app, '/chat/delete', async (req, res) => {
    const sendError = (msg) => {
        console.log(msg);
        res.send({ error: msg });
    }

    if (req.session.user === undefined) return sendError("You must be logged in to create a new chat.");

    if (req.body === undefined) return sendError("Missing body.");

    if (req.body.chat_id === undefined) return sendError("Chat id missing.");

    const chat = await UserDB.getChatData(req.body.chat_id);

    if (chat) {
        if (chat.owner !== req.session.user.username) return sendError("Only the owner of the chat can delete the chat.");
        
        const participants = JSON.parse(chat.participants).participants;
        
        for (let i = 0; i < participants.length; i++) {
            const element = participants[i];
            wss.stateupdate(element, "deleted_chat", { chat_id: chat.chat_id });
            await UserDB.removeUserPermission(chat.chat_id, element);
        }

        await UserDB.deleteChat(chat.chat_id);
    }
    else return sendError("Chat not found.");
});

Messenger.setPostRoute(app, '/chat/add', async (req, res) => {
    const sendError = (msg) => {
        console.log(msg);
        res.send({ error: msg });
    }

    if (req.session.user === undefined) return sendError("You must be logged in.");

    if (req.body === undefined) return sendError("Missing body.");

    console.log(req.body);
    if (req.body.chat_id === undefined || req.body.username === undefined) return sendError("Missing arguments.");

    const chat = await UserDB.getChatData(req.body.chat_id);
    const user = await UserDB.getUserData(req.body.username);

    if (!user) {
        return sendError("User doesn't exist.");
    }
    else if (chat) {
        await UserDB.addUserToChat(chat.chat_id, req.body.username);
        res.send({ code: 200 });
    }
    else {
        return sendError("Unknown chat.");
    }
})

Messenger.setGetRoute(app, '/chat/:chatid', async (req, res) => {
    const chat = await UserDB.getChatData(req.params.chatid);
    console.log(chat);
    if (chat !== undefined)
        res.send(chat);
    else res.send({ error: "Chat not found" });
});

Messenger.setGetRoute(app, '/profile', (req, res) => {
    if (req.session.user !== undefined) {
        res.render('pages/profile', { username: req.session.user.username });
    }
    else res.redirect('/');
});

Messenger.setGetRoute(app, '/logout', (req, res) => {
    if (req.session.user !== undefined) {
        UserDB.userLoggedOut(req.session.user.username);
        req.session.user = undefined;
    }
    res.redirect('/login');
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

Messenger.setGetRoute(app, '/signup', (req, res) => {
    if (req.session.user !== undefined) return res.redirect('/profile');

    res.render('pages/signup');
});

Messenger.setPostRoute(app, '/signup', async (req, res) => {
    const sendError = (msg) => {
        console.log(msg);
        res.send({ error: msg });
    }

    if (req.session.user !== undefined) return sendError("You are already logged in!");

    if (req.session.loginAttempt === undefined) req.session.loginAttempt = 1;
    else if (req.session.loginAttempt > 6) return error("Too many failed login attempts. Try again later.");
    else req.session.loginAttempt++;
    req.session.save();
    console.log(req.session.loginAttempt);

    const verify_if_user_exists = async () => {
        const _user = await UserDB.getUserData(req.body.username);
        if (_user) {
            return _user;
        }
        else return;
    }

    if (req.body) {
        if (req.body.username && req.body.password) {
            const _user = await verify_if_user_exists();
            if (_user) {
                return sendError("A user with this name already exists.");
            }
            else {
                console.log("Verified");
                req.session.loginAttempt--;
                await UserDB.createUser(req.body.username, req.body.password);

                const user = {
                    username: req.body.username,
                    score: 0
                }

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
        }
        else return sendError("Missing arguments");
    }
    else return sendError("Missing body...");
});

Messenger.setPostRoute(app, '/login', async (req, res) => {
    const sendError = (msg) => {
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

    const verify_if_user_exists = async () => {
        const _user = await UserDB.getUserData(req.body.username);
        if (_user) {
            return _user;
        }
        else return;
    }

    const verify_user_data = async (user) => {
        console.log("Verifying")
        const value = await UserDB.verifyUser(req.body.username, req.body.password);
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
            return sendError("Wrong password.");
        }
    }

    if (req.session.user === undefined) {
        session_login_attempt();
        if (req.body === undefined) return sendError("Missing body");
        if (!UserDB.verifyInput(req.body.username, req.body.password)) return sendError("Fuck off. Actually just get the fuck out of here fuckhead. Script kiddie");
        console.log("Looking for user.");
        const user = await verify_if_user_exists();
        console.log("Fetched user");
        if (user) {
            console.log("Found user");
            verify_user_data(user);
        }
        else return sendError("User not found.");
    }
});

wss.addMessageHandler("message", (ws, json, req) => {
    console.log(json);
    if (json.message.length === 0) return;
    if (wss.hasLinkedConnection(ws))
        UserDB.userMessage(wss, wss.getLinkedConnection(ws).username, json.chat_id, json.message);
    else ws.send(JSON.stringify({ path: "error", error: "The user isn't linked..."}));
});

wss.addMessageHandler("link", (ws, json, req) => {
    if (json.user_token !== undefined) {
        console.log(json);
        const username = UserDB.getLoggedInUser(json.user_token);
        console.log(username);
        if (username === undefined) return;
        wss.linkWebsocketConnection(ws, json.user_token, username);
        console.log("Linked websocket to user.");
    }
});

Messenger.setUses(app);