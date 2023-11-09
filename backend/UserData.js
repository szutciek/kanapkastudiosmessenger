const { Database } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();
const uuid = require('uuid');

class DataStorage {
    /** @type {Database} */
    #db;

    constructor(dataPath) {
        this.#db = new sqlite3.Database('../UserData/user.db');
    }

    getUserData(username) {
        if (!this.verifyInput(username, "")) return false;
        this.#get(`SELECT * FROM users WHERE username='${username}';`, (err, row) => {
            if (err !== null) {
                return null;
            }
            else {
                return row;
            }
        });
    }

    verifyUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        this.#get(`SELECT username, password FROM users WHERE username='${username}' AND password='${password}';`, (err, row) => {
            if (err !== null)
                return false;
            else
                return true;
        });
        return false;
    }

    verifyInput(username, password) {
        if (username.length > 16 || password.length > 20) return false;
        return true;
    }

    createUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        if (this.getUserData(username) !== null) return false;


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

    test() {
        this.#run(`UPDATE users SET password = 'good' WHERE username = 'test'`, (result, err) => {
            if (err !== null) return false;
            else return result;
        });
    }
}

const storage = new DataStorage("a");

storage.test();

console.log(storage.verifyUser("test", "good"));