const Messenger = require('./backend/Messenger.js');

const app = Messenger.createServer();
const wss = Messenger.createWebsocketServer();

Messenger.setGetRoute(app, '/', (req, res) => {
    res.render('pages/index');
});

Messenger.setGetRoute(app, '/login', (req, res) => {
    // check if user is logged in
    res.render('pages/login', { message: "pending" });
});

Messenger.setPostRoute(app, '/login', (req, res) => {
    
});

wss.addMessageHandler("message", (ws, json, req) => {

});

Messenger.setUses(app);