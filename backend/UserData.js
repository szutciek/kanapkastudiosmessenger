const { Database } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();
const uuid = require('uuid');

class DataStorage {
    /** @type {Database} */
    #db;
    #LoggedInUsers = new Map();


    constructor(dataPath) {
        this.#db = new sqlite3.Database(dataPath);
    }

    getUserData(username) {
        if (!this.verifyInput(username, "")) return false;
        this.#get(`SELECT * FROM users WHERE username='${username}';`, (err, row) => {
            if (err !== null) {
                console.log(err);
                return null;
            }
            else {
                console.log("Returning user data.");
                return row;
            }
        });
    }

    verifyUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        this.#get(`SELECT username, password FROM users WHERE username='${username}' AND password='${password}';`, (err, row) => {
            if (err !== null) {
                console.log(err);
                return false;
            }
            else {
                console.log("Username and password match.");
                return true;
            }
        });
        return false;
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

    getChatData(chat_id) {
        this.#get(`SELECT * FROM chatdata WHERE chat_id='${chat_id}';`, (err, row) => {
            if (err !== null) {
                console.log(err);
                return null;
            }
            return row;
        });
        return null;
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

        this.#update("chatdata", "messages", JSON.stringify(json), "uuid", chat_id);
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

    #run(sql, callback) {
        this.#db.serialize(() => {
            this.#db.run(sql, callback);
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
}

module.exports = { DataStorage };