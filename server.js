const express = require("express");
const app = express();
const path = require("path");

const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 7777 });

wss.on("connection", (ws) => {
    console.log("content");
    ws.send('jfoisjfiodjfdosi')
    ws.on('message', (ws) => {
        console.log(ws)
    });
    ws.emit(JSON.stringify({ data: "suck cock" }))
});



app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/test", (req, res) => {
    res.send({ test: "test" })
});

app.listen(8008, () => {
    console.log(`Server listening to port 8008`);
});