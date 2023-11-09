const express = require('express');
const bodyParser = require('body-parser');
const { WebSocketServer } = require('ws');

function createServer() {
    const app = express();
    app.use(bodyParser.json());

    app.set('view engine', 'ejs');

    app.listen(3000, () => {
        console.log(`listening on 3000`);
    })

    return app;
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
                handler(json, req);
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
}

module.exports = { createServer, setGetRoute, setPostRoute, setUses, createWebsocketServer };