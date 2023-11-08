const express = require('express');

function createServer() {
    const app = express();

    app.set('view engine', 'ejs');

    app.listen(3000, () => {
        console.log(`listening on 3000`);
    })

    return app;
}

function setGetRoute(app, path, callback) {
    app.get(path, callback);
}

function setPostRoute(app, path, callback) {
    app.post(path, callback);
}

function setUses(app) {
    app.use(express.static('public'))
}

module.exports = { createServer, setGetRoute, setPostRoute, setUses };