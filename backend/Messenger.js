const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { WebSocketServer } = require('ws');
const { v4 } = require('uuid');

function createServer() {
    const app = express();
    app.use(bodyParser.json());
    app.use(cookieParser());
    app.use(session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: true, maxAge: 1000 * 60 * 60 * 24 },
    }));

    app.set('view engine', 'ejs');

    app.listen(3000, () => {
        console.log(`listening on 3000`);
    })

    return app;
}

function resetSessionIfLoggedIn(req) {
    if (req.session.token !== undefined) {
        req.session.token = undefined;
        req.session.user = undefined;
    }
}

function uuid() {
    return v4();
}

function setGetRoute(app, path, callback) {
    app.get(path, (req, res) => {
        callback(req, res);
    });
}

function setPostRoute(app, path, callback) {
    app.post(path, (req, res) => {
        callback(req, res);
    });
}

function setUses(app) {
    app.use(express.static('public'));
}

function createWebsocketServer(port) {
    return port === undefined ? new MessengerWebSocketServer(7777) : new MessengerWebSocketServer(port);
}

class MessengerWebSocketServer {
    /** @type {WebSocketServer} */
    WSS;
    #ServerMessageHandlers = new Map();

    #LinkedUsers = new Map();
    #LinkedUsers_Username = new Map();

    constructor(port) {
        this.WSS = new WebSocketServer({ port: port });

        this.WSS.on('connection', (ws, req) => {
            this.#open(ws,req);
            ws.on('message', (data) => {
                this.#message(ws, data, req);
            });
            ws.on('error', (err) => {
                this.#error(ws, err);
            });
            ws.on('close', (data) => {
                this.#exit(ws, data);
            });
        });
    }

    addMessageHandler(path, callback) {
        this.#ServerMessageHandlers.set(path, callback);
    }

    #message(ws, data, req) {
        try {
            const json = JSON.parse(data);

            const handler = this.#ServerMessageHandlers.get(json.path);

            if (handler !== undefined)
                handler(ws, json, req);
        } catch {
            console.error(" Malformed JSON. " + data);
        }
    }

    #error(ws, err) {

    }

    #open(ws, req) {

    }

    #exit(ws, data) {

    }

    resetWebsocketConnection(token) {
        this.#LinkedUsers.delete(token);
    }

    linkWebsocketConnection(ws, token, username) {
        this.#LinkedUsers.set(ws, { token: token, username: username });
        this.#LinkedUsers_Username.set(username, ws);
    }

    getLinkedConnection(ws) {
        return this.#LinkedUsers.get(ws);
    }
}

module.exports = { createServer, setGetRoute, setPostRoute, setUses, createWebsocketServer, uuid, resetSessionIfLoggedIn };