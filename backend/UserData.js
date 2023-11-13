const { Database } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();
const uuid = require('uuid');

class DataStorage {
    /** @type {Database} */
    #db;
    #LoggedInUsers = new Map();

    #currentlyOpenChats = new Map();

    constructor(dataPath) {
        this.#db = new sqlite3.Database(dataPath);

        this.#RUN(`CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, password TEXT NOT NULL, score INTEGER DEFAULT 0 NOT NULL, lastOnline TEXT);`, []);
        /**
         * {
    "uuid": "Chat uuid",
    "owner": "username",
    "messages": "Json stringified array of chat messages",
    "participants": "Json stringified array of usernames"
}
         */
        this.#RUN(`CREATE TABLE IF NOT EXISTS chatdata(uuid TEXT PRIMARY KEY, owner TEXT NOT NULL, message TEXT DEFAULT '[]', participants TEXT DEFAULT '[]');`, [])

        setInterval(() => {
            this.disposeOfChats();
        }, 1000 * 60);
    }

    disposeOfChats() {
        let now = Date.now();
        let values = this.#currentlyOpenChats.values();
        for (const chat in values) {
            if (now - chat.lastAccessed > 1000 * 60 * 60) {
                this.#currentlyOpenChats.delete(chat.uuid);
            }
        }
    }

    getUserData(username) {
        if (!this.verifyInput(username, "")) return;
        return new Promise((resolve, reject) => {
            this.#db.get(`SELECT * FROM users WHERE username = ?;`, [username], (err, row) => {
                if (err) {
                    reject(err);
                    return console.log(err.message);
                }
                if (row) {
                    resolve(row);
                    return;
                }
            });
        })
    }

    async verifyUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        const user = (await this.#GET(`SELECT username, password FROM users WHERE username = ? AND password = ?;`, [username, password]));
        return user !== undefined && user !== null;
    }

    userMessage(username, chat_id, message) {
        if (this.hasPermissionIn(username, chat_id)) {
            this.createChatMessage(username, chat_id, message);
        }
    }

    hasPermissionIn(username, chat_id) {
        const chatdata = this.getChatData(chat_id);
        if (chatdata !== undefined) {
            const json = JSON.parse(chatdata.participants);
            return json[username] !== undefined;
        }
        return false;
    }

    async getChatData(chat_id) {
        if (this.#currentlyOpenChats.has(chat_id)) {
            let c = this.#currentlyOpenChats.get(chat_id);
            c.lastAccessed = Date.now();
            return c;
        }
        const chatdata = await this.#GET(`SELECT * FROM chatdata WHERE chat_id=?;`, [chat_id]);
        chatdata.lastAccessed = Date.now();
        this.#currentlyOpenChats.set(chat_id, chatdata);
        return chatdata;
    }

    createChatMessage(username, chat_id, message) {
        const chatdata = this.getChatData(chat_id);
        const json = JSON.parse(chatdata.messages);
        /**
         * "username": "username",
            "date": "00/00/0000",
            "message": "content"
         */
        json.push({
            username: username,
            date: new Date(Date.now()).toDateString(),
            message: message
        });

        chatdata.messages = JSON.stringify(json);
    }

    verifyInput(username, password) {
        if (username.length > 16 || password.length > 20) return false;
        return true;
    }

    createUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        if (this.getUserData(username) !== null) return false;
    }

    userLoggedIn(token, username) {
        this.#LoggedInUsers.set(token, username);
    }

    getLoggedInUser(token) {
        return this.#LoggedInUsers.get(token);
    }

    #get(sql, callback) {
        this.#db.serialize(() => {
            this.#db.get(sql, callback);
        });
    }

    async #GET(sql, params) {
        const w = await new Promise((resolve, reject) => {
            this.#db.serialize(() => {
                this.#db.get(sql, params, (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (row) {
                        resolve(row);
                        return;
                    }
                    resolve(null);
                });
            });
        });
        return w;
    }

    #run(sql, callback) {
        this.#db.serialize(() => {
            this.#db.run(sql, callback);
        });
    }

    #RUN(sql, params) {
        this.#db.serialize(() => {
            this.#db.run(sql, params, (err, row) => {
                if (err) {
                    console.log(err);
                }
            });
        });
    }

    #update(table, name, value, where_name, where_value) {
        this.#db.run(`UPDATE ${table} SET ${name} = ${value} WHERE ${where_name} = ${where_value};`, (result, err) => {
            return err === null ? result : err;
        });
    }

    #test() {
        this.#run(`UPDATE users SET password = 'good' WHERE username = 'test'`, (result, err) => {
            if (err !== null) {
                console.log(err);
                return false;
            }
            else {
                console.log("Username and password match.");
                return result;
            }
        });
    }

    cleanup() {
        for (const chat in this.#currentlyOpenChats) {
            this.saveChat(chat);
        }
    }

    saveChat(chat) {
        this.#db.serialize(() => {
            this.#db.run(`UPDATE chatdata
                SET messages = ?
                WHERE uuid = ${chat.uuid}
            `, [JSON.stringify(chat.messages)]);
        });
    }
}

module.exports = { DataStorage };