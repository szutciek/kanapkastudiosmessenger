const express = require("express");
const app = express();

app.on('/', (req, res) => {
    console.log('Server received request');
})

app.listen(8008, () => {
    console.log(`Server listening to port 8008`);
})