const express = require("express");
const app = express();
const path = require("path");

const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 7777 });

wss.on("connection", (ws) => {
  console.log("content");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(8008, () => {
  console.log(`Server listening to port 8008`);
});
