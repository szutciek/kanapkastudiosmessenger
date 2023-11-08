const Messenger = require('./backend/Messenger.js');

const app = Messenger.createServer();

Messenger.setGetRoute(app, '/', (req, res) => {
    res.render('pages/index');
})

Messenger.setUses(app);