const express = require("express");
const app = express();
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8008 });
wss.on('connection', (ws) => {
    const id = uuidv4();
    const color = Math.floor(Math.random() * 360);
    const metadata = { id, color };
    clients.set(ws, metadata);
});
const clients = new Map();

app.on('/', (req, res) => {
    console.log('Server received request');
})

app.listen(8008, () => {
    console.log(`Server listening to port 8008`);
})