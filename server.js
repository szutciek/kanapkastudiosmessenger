const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");

app.use(express.static(__dirname));
app.use(express.json());

const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 7777 });

var chat = [];
fs.readFile(path.join(__dirname, 'chat.txt'), (err, data) => {
    if (err) return;
    chat = JSON.parse(data).chat;
})

wss.on("connection", (ws) => {
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            //console.log(message);
            if (message.type === 'NCM') {
                chat.push({ user: message.user, message: message.message });
                wss.clients.forEach(client => client.send(JSON.stringify({ type: "NC", body: { user: message.user, message: message.message } })));
            } else if (message.type === 'GetC') {
                ws.send(JSON.stringify({ type: "UC", body: chat }));
            }
            if (chat.length > 200) {
                chat.splice(0, 1);
            }
        } catch {}
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(3000, () => {
    console.log(`Server listening to port 3000`);
    setInterval(() => {
        fs.writeFile(path.join(__dirname, "chat.txt"), JSON.stringify({ chat: chat }), (err) => { if (err) return; })
    }, 2000);
});