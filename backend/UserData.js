const { Database } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();
const uuid = require('uuid');

class DataStorage {
    /** @type {Database} */
    #db;
    #LoggedInUsers = new Map();
    #UsersLoggedIn = new Map();

    #currentlyOpenChats = new Map();

    constructor(dataPath) {
        this.#db = new sqlite3.Database(dataPath);

        this.#createTables();

        setInterval(() => {
            this.disposeOfChats();
        }, 1000 * 60);
    }

    async #createTables() {
        await this.#RUN(`CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, password TEXT NOT NULL, score INTEGER DEFAULT 0 NOT NULL, lastOnline TEXT);`, []);

        await this.#RUN(`CREATE TABLE IF NOT EXISTS chatdata(uuid TEXT PRIMARY KEY, chatname TEXT, owner TEXT NOT NULL, message TEXT DEFAULT '[]', participants TEXT DEFAULT '[]');`, [])

        await this.#RUN(`CREATE TABLE IF NOT EXISTS chatperms(username TEXT PRIMARY KEY, chatAccess TEXT DEFAULT '[]');`, [])

        console.log("done");
    }

    disposeOfChats() {
        let now = Date.now();
        let values = this.#currentlyOpenChats.values();
        for (const chat in values) {
            if (chat.lastAccessed === undefined) {
                console.log("chat is not available");
                continue;
            }
            if (now - chat.lastAccessed > 1000 * 60 * 60) {
                this.saveChat(chat);
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

    userMessage(wss, username, chat_id, message) {
        if (this.hasPermissionIn(username, chat_id)) {
            this.createChatMessage(wss, username, chat_id, message);
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

    createChatMessage(wss, username, chat_id, message) {
        this.getChatData(chat_id).then(chatdata => {
            const json = JSON.parse(chatdata.messages);
            /**
             * "username": "username",
                "date": "00/00/0000",
                "message": "content"
            */
            const msg = {
                username: username,
                date: new Date(Date.now()).toDateString(),
                message: message
            };
            json.push(msg);

            for (const user in chatdata.participants) {
                wss.sendMessage(wss.getLinkedUser(user), msg);
            }

            chatdata.messages = JSON.stringify(json);
        });
    }

    verifyInput(username, password) {
        if (username.length > 16 || password.length > 20) return false;
        return true;
    }

    createUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        this.getUserData(username).then(value => {
            if (value === undefined) {
                this.#defineNewUser(username, password);
            }
        });
    }

    #defineNewUser(username, password) {
        this.#RUN(`INSERT INTO users(username, password, score, lastOnline) VALUES(?, ?, 0, ?)`, [username, password, new Date(Date.now()).toDateString]);
    }

    async createChat(owner, chatname) {
        return await this.#RUN('INSERT INTO chatdata(uuid, chatname, owner, messages, participants) VALUES (?, ?, ?, ?, ?)', [uuid(), chatname, owner, "[]", JSON.stringify([owner])]);
    }

    async getUsersChats(owner) {

    }

    userLoggedIn(token, username) {
        this.#LoggedInUsers.set(token, username);
        this.#UsersLoggedIn.set(username, token);
    }

    userLoggedOut(username) {
        this.#LoggedInUsers.delete(this.#UsersLoggedIn.get(username));
        this.#UsersLoggedIn.delete(username);
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
        return new Promise((resolve, reject) => {
            this.#db.serialize(() => {
                this.#db.run(sql, params, (err, row) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    if (row) {
                        resolve(row);
                    }
                    else resolve(null);
                });
            });
        })
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

        this.#db.close();
    }

    saveChat(chat) {
        this.#db.serialize(() => {
            this.#db.run(`UPDATE chatdata
                SET messages = ?, participants = ?
                WHERE uuid = ${chat.uuid}
            `, [JSON.stringify(chat.messages), JSON.stringify(chat.participants)]);
        });
    }
}

module.exports = { DataStorage };