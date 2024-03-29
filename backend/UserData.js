const { Database } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();
const uuid = require('uuid');
const Messenger = require('./Messenger.js');
const crypto = require('crypto');

class DataStorage {
    /** @type {Database} */
    #db;
    #LoggedInUsers = new Map();
    #UsersLoggedIn = new Map();

    #currentlyOpenChats = new Map();

    #accessTimes = new Map();

    constructor(dataPath) {
        this.#db = new sqlite3.Database(dataPath);

        this.#createTables();

        setInterval(() => {
            this.disposeOfChats();
        }, 1000 * 60);
    }

    async #createTables() {
        await this.#RUN(`CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, password TEXT NOT NULL, score INTEGER DEFAULT 0 NOT NULL, lastOnline TEXT);`, []);

        await this.#RUN(`CREATE TABLE IF NOT EXISTS chatdata(chat_id TEXT PRIMARY KEY, chatname TEXT, owner TEXT NOT NULL, messages JSON, participants JSON);`, []);

        await this.#RUN(`CREATE TABLE IF NOT EXISTS chatperms(username VARCHAR(37) PRIMARY KEY, chatAccess TEXT DEFAULT '[]');`, []);

        console.log("done");
    }

    disposeOfChats() {
        let now = Date.now();
        let values = this.#currentlyOpenChats.values();
        for (const chat in values) {
            const time = now - this.#accessTimes.get(chat.chat_id);
            if (this.#accessTimes.get(chat.chat_id) === undefined) {
                console.log("chat is not available");
                continue;
            }
            if (time > 1000 * 60 * 5) {
                this.saveChat({ chat_id: chat.chat_id, messages: JSON.parse(chat.messages).messages, participants: JSON.parse(chat.participants).participants });
                this.#currentlyOpenChats.delete(chat.chat_id);
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
                resolve(row);
            });
        })
    }

    async verifyUser(username, password) {
        if (!this.verifyInput(username, password)) return false;
        const user = (await this.#GET(`SELECT username, password FROM users WHERE username = ? AND password = ?;`, [username, password]));
        return user !== undefined && user !== null;
    }

    async userMessage(wss, username, chat_id, message) {
        if (await this.hasPermissionIn(username, chat_id)) {
            this.createChatMessage(wss, username, chat_id, message);
            console.log("Creating message");
        }
        else console.log(username + " has no permission in " + chat_id);
    }

    async hasPermissionIn(username, chat_id) {
        const chatdata = await this.getChatData(chat_id);
        if (chatdata !== undefined) {
            const json = JSON.parse(chatdata.participants).participants;
            return json.includes(username);
        }
        return false;
    }

    async getChatData(chat_id) {
        if (this.#currentlyOpenChats.has(chat_id)) {
            let c = this.#currentlyOpenChats.get(chat_id);
            this.#accessTimes.set(chat_id, Date.now());
            return c;
        }
        const chatdata = await this.#GET(`SELECT * FROM chatdata WHERE chat_id=?;`, [chat_id]);
        this.#accessTimes.set(chat_id, Date.now());
        this.#currentlyOpenChats.set(chat_id, chatdata);
        return chatdata;
    }

    createChatMessage(wss, username, chat_id, message) {
        console.log("Creating chat message");
        this.getChatData(chat_id).then(chatdata => {
            const json = JSON.parse(chatdata.messages).messages;
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
            console.log(json);
            json.push(msg);

            if (json.length > 100) {
                json.splice(0, json.length - 101);
            }

            console.log(chatdata);

            const participants = JSON.parse(chatdata.participants).participants;
            console.log(participants);

            for (let i = 0; i < participants.length; i++) {
                const user = participants[i];
                wss.sendMessage(user, chat_id, msg);
            }

            chatdata.messages = JSON.stringify({messages: json});
            this.saveChat({chat_id: chat_id, messages: json, participants: participants });
            console.log("Created chat message");
        });
    }

    verifyInput(username, password) {
        if (username.length > 16 || password.length > 20) return false;
        return true;
    }

    async createUser(username, password) {
        if (!this.verifyInput(username, password)) return;
        const value = await this.getUserData(username);
        if (!value) {
            return await this.#defineNewUser(username, password);
        }
        else {
            return;
        }
    }

    async #defineNewUser(username, password) {
        return await this.#RUN(`INSERT INTO users(username, password, score, lastOnline) VALUES(?, ?, 0, ?)`, [username, password, new Date(Date.now()).toDateString]);
    }

    async createChat(owner, chatname) {
        const data = [Messenger.uuid(), chatname, owner, JSON.stringify({ messages: [] }), JSON.stringify({participants: [owner]})];
        console.log(data);
        await this.#RUN('INSERT INTO chatdata (chat_id, chatname, owner, messages, participants) VALUES (?, ?, ?, json(?), json(?))', data);
        console.log(JSON.stringify([]));
        await this.addUserPermission(data[0], owner);
        await this.saveChatAsync({chat_id: data[0], chatname: chatname, owner: owner, messages: [], participants: [owner]});
        return data;
    }

    async deleteChat(chat_id) {
        await this.#RUN('DELETE FROM chatdata WHERE chat_id = ?', [chat_id]);
        this.#currentlyOpenChats.delete(chat_id);
        this.#accessTimes.delete(chat_id);
        console.log("Deleted Chat.");
    }

    async getUsersChats(user) {
        const perms = await this.getUserPermissions(user);
        const chats = [];
        if (perms)
            for (let i = 0; i < perms.length; i++) {
                const element = perms[i];
                
                const chat = await this.#GET('SELECT chat_id, chatname FROM chatdata WHERE chat_id = ?', [element]);
                chats.push(chat);
            }
        return chats;
    }

    async addUserToChat(chat_id, username) {
        console.log("adding user to chat");
        const chat = await this.getChatData(chat_id);
        console.log("finished chat await");
        if (!chat) return;
        console.log("chat exists " + chat);
        const participants = JSON.parse(chat.participants).participants;
        console.log("got participants parsed");
        if (!participants.includes(username))
            participants.push(username);
        console.log("appended user to participants");
        chat.participants = JSON.stringify({ participants: participants });
        console.log("added participants");
        await this.addUserPermission(chat_id, username);
        console.log("added user permission to chat!");
        this.saveChat(chat);
        console.log("saved chat");
    }

    async addUserPermission(chat_id, username) {
        await this.createPermissionsFor(username);
        console.log("created permissions for " + username);
        const chatAccess = await this.getUserPermissions(username);
        console.log("fetched user permissions");
        if (chatAccess !== undefined)
            if (!chatAccess.includes(chat_id))
                chatAccess.push(chat_id);
            else {
                console.log("Already has permissions for " + chat_id);
            }
        else {
            console.log("user doesn't have permissions??");
        }
        await this.#RUN('UPDATE chatperms SET chatAccess = json(?) WHERE username = ?', [JSON.stringify(chatAccess), username]);
        console.log("updated chatperms table.");
    }

    async removeUserPermission(chat_id, username) {
        await this.createPermissionsFor(username);
        console.log("created permissions for " + username);
        const chatAccess = await this.getUserPermissions(username);
        console.log("fetched user permissions");
        if (chatAccess !== undefined) {
            for (let i = 0; i < chatAccess.length; i++) {
                if (chatAccess[i] === chat_id) {
                    console.log("removed " + chatAccess[i] + " for " + username);
                    chatAccess.splice(i, 1);
                    break;
                }
            }
        }
        else {
            console.log("user doesn't have permissions??");
        }
        await this.#RUN('UPDATE chatperms SET chatAccess = json(?) WHERE username = ?', [JSON.stringify(chatAccess), username]);
        console.log("updated chatperms table.");
    }

    async getUserPermissions(username) {
        const perms = await this.#GET('SELECT chatAccess FROM chatperms WHERE username = ?', [username]);
        if (perms) {
            console.log("Returing permissions for " + username);
            return JSON.parse(perms.chatAccess);
        }
        else console.error("No permissions...");
    }

    async createPermissionsFor(username) {
        const perms = await this.#GET('SELECT * FROM chatperms WHERE username = ?', [username]);
        if (!perms)
            await this.#RUN('INSERT INTO chatperms (username, chatAccess) VALUES (?, json(?))', [username, JSON.stringify([])]);
        else console.log("User permissions already exist!");
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
                    resolve(row);
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

    cleanup() {
        for (const chat in this.#currentlyOpenChats) {
            this.saveChat(chat);
        }

        this.#db.close();
    }

    saveChat(chat) {
        this.#db.serialize(() => {
            this.#db.run(`UPDATE chatdata
                SET messages = json(?), participants = json(?)
                WHERE chat_id =?
            `, [JSON.stringify({messages: chat.messages}), JSON.stringify({participants: chat.participants}), chat.chat_id]);
        });
    }

    async saveChatAsync(chat) {
        await new Promise((resolve, reject) => {
            this.#db.serialize(() => {
                this.#db.run(`UPDATE chatdata
                    SET messages = json(?), participants = json(?)
                    WHERE chat_id =?
                `, [JSON.stringify({messages: chat.messages}), JSON.stringify({participants: chat.participants}), chat.chat_id], err => {
                    
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        })
    }
}

class ChatStorage {
    /** @type {Database} */
    #db;

    constructor(path) {
        this.#db = new Database(path);
    }

    getChatMessages(chat_id, num) {

    }

    addMessageToChat(chat_id, message) {

    }
}

module.exports = { DataStorage };