var selected_chat_id;

const setup = async () => {
    /** @type {WebSocket} */
    var socket;
    const chatView = document.querySelector('.here_append');
    const input_element = document.getElementById('input');
    const send_button = document.getElementById('send');

    const stored_sent = [];
    var stored_sent_index = 0;

    const fillout = () => {
        if (stored_sent.length > 0)
            input_element.value = stored_sent[stored_sent_index];
    }

    document.addEventListener('keydown', ev => {
        if (document.activeElement === input_element) {
            if (ev.key === 'Enter') {
                console.log(input_element.value);
                if (input_element.value.length > 0 && input_element.value[0] === '!')
                    command(input_element.value);
                else sendMessage(input_element.value);
                input_element.value = "";
            }

            if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
                stored_sent_index = Math.max(Math.min(stored_sent_index + (ev.key === "ArrowUp" ? 1 : -1), stored_sent.length - 1), 0);
                fillout();
            }
        }
    });

    const sendMessage = (msg) => {
        if (msg.length === 0) return;
        if (selected_chat_id === undefined) return console.log("No chat selected");
        if (socket.readyState === socket.OPEN) {
            stored_sent.push(msg);
            stored_sent_index = 0;
            socket.send(JSON.stringify({ path: "message", chat_id: selected_chat_id, message: msg }));
        }
    }

    const createSocket = async () => {
        console.log("starting socket");
        socket = new WebSocket('ws://' + location.hostname + ':7777/ws');

        socket.onopen = (ev) => {
            console.log("Socket opened.");
            socket.send(JSON.stringify({
                path: "link",
                user_token: localStorage.getItem("token")
            }));
            document.querySelector('.LoadingScreen').remove();
        }

        socket.onmessage = (data) => {
            try {
                const json = JSON.parse(data.data);

                if (json.path === 'message') {
                    const p = getMessageP(json.username, json.message);
                    chatView.append(p);
                    p.scrollIntoView();
                }
                else if (json.path === 'error') {
                    displayError(json.error);
                }
                else if (json.path === "deleted_chat") {
                    const chat = document.querySelector(`[data-chat_id=${json.message.chat_id}]`);

                    if (chat) {
                        if (selected_chat_id === json.message.chat_id) {
                            clearChatView();
                            displayError("Your last active chat has been deleted. '" + chat.innerText + "'");
                            selected_chat_id = undefined;
                        }
                        chat.remove();
                    }
                }
            }
            catch (e) {
                console.error(e);
            }
        }

        socket.onerror = (err) => {
            console.error(err);
            socket.close();
        }

        socket.onclose = (ev) => {
            setTimeout(() => {
                createSocket();
            }, 500);
        }
    }

    createSocket();
}
getChats();
setup();

function getChats() {
    fetch('/chat/data', {
        method: "GET"
    }).then(data => {
        data.json().then(json => {
            if (json.error !== undefined) {
                console.error(json.error);
            }
            else {
                console.log(json.perms)
                for (let i = 0; i < json.perms.length; i++) {
                    const element = json.perms[i];
                    
                    if (element !== null)
                        CreateChat(element.chatname, element.chat_id);
                }
            }
        })
    }).catch(reason => {
        displayError(reason);
    });
}

function createNewChat() {
    const chat_create = document.createElement('input');
    chat_create.classList.add("chat");
    document.querySelector('.chats').append(chat_create);
    chat_create.focus();
    chat_create.addEventListener('keydown', e => {
        console.log("Bobux");
        if (e.key === 'Enter') {
            fetch('/chat/create', {
                method: "POST",
                body: JSON.stringify({
                    chatname: chat_create.value
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            }).then(value => {
                value.json().then(json => {
                    console.log(json);
                    if (json.error !== undefined) {
                        displayError(json.error);
                    }
                    else {
                        chat_create.remove();
                        CreateChat(json.chatname, json.chat_id);
                    }
                })
            }).catch(reason => {
                displayError(reason);
            });
            console.log("AAA");
        }
    });
}

function CreateChat(chatname, chat_id) {
    const chat = document.createElement('button');
    chat.innerText = chatname;
    chat.dataset.chat_id = chat_id;
    chat.classList.add("chat");
    chat.addEventListener('dblclick', (e) => {
        fetch('/chat/delete', {
            method: "POST",
            body: JSON.stringify({
                chat_id: chat_id
            }),
            headers: {
                "Content-Type": "application/json"
            }
        }).then(value => {
            value.json().then(json => {
                console.log(json);
                if (json.error !== undefined) {
                    displayError(json.error);
                }
                else {
                    console.log("Removed chat " + chat_id);
                    chat.remove();
                }
            })
        }).catch(reason => {
            displayError(reason);
        });
    })
    document.querySelector('.chats').append(chat);
    chat.addEventListener('click', (e) => {
        showChatContent(chat.dataset.chat_id, chat);
    });
    showChatContent(chat_id, chat);
}

function showChatContent(chat_id, element) {
    fetch('/chat/' + chat_id, {
        method: "GET",
    }).then(value => {
        value.json().then(json => {
            console.log("Gotchat");
            console.log(json);
            if (json.error !== undefined) {
                displayError(json.error);
                element.remove();
            }
            else {
                displayChatContent(json);
                element.scrollIntoView();
            }
        })
    }).catch(reason => {
        displayError(reason);
    });
}

function displayError(error) {
    clearChatView();
    const chatView = document.querySelector('.chatView');
    chatView.append(getErrorP(error));
    console.log("Appended error");
}

function getMessageP(name, message) {
    const n = document.createElement('span');
    n.classList.add('name');
    n.innerText = name;
    if (localStorage.getItem("username") === name)
        n.style.color = 'red';
    const p = document.createElement('p');
    p.appendChild(n);
    p.classList.add('message');
    const msg = document.createElement('span');
    msg.innerText = message;
    p.appendChild(msg);
    return p;
}

function getErrorP(error) {
    const name = document.createElement('span');
    name.classList.add('name');
    name.style.color = '#ff9999';
    name.innerText = 'KSCS';
    const p = document.createElement('p');
    p.appendChild(name);
    p.classList.add('message');
    const msg = document.createElement('span');
    msg.innerText = error;
    p.appendChild(msg);

    return p;
}

function getSuccessP(error) {
    const name = document.createElement('span');
    name.classList.add('name');
    name.style.color = '#9999ff';
    name.innerText = 'KSCS';
    const p = document.createElement('p');
    p.appendChild(name);
    p.classList.add('message');
    const msg = document.createElement('span');
    msg.innerText = error;
    p.appendChild(msg);

    return p;
}

function displayChatContent(chat) {
    clearChatView();
    document.getElementById('input').focus();
    const chatView = document.querySelector('.here_append');
    console.log(chat);
    selected_chat_id = chat.chat_id;

    const messages = JSON.parse(chat.messages).messages;

    messages.forEach(element => {
        chatView.append(getMessageP(element.username, element.message));
    });

    if (chatView.lastChild !== null)
        chatView.lastChild.scrollIntoView();
}

function clearChatView() {
    const chatView = document.querySelector('.here_append');
    while (chatView.firstChild) {
        chatView.removeChild(chatView.firstChild);
    }
}


function command(value) {
    const args = value.split(' ');

    if (args[0] === "!add") {
        if (selected_chat_id === undefined) {
            document.querySelector('.here_append').append(getErrorP("No chat selected."));
        }
        else if (args.length >= 2) {
            console.log(args);
            console.log(JSON.stringify({
                chat_id: selected_chat_id,
                username: args[1]
            }));
            fetch('/chat/add', {
                method: "POST",
                body: JSON.stringify({
                    chat_id: selected_chat_id,
                    username: args[1]
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            }).then(data => data.json().then(json => {
                if (json.error !== undefined) {
                    document.querySelector('.here_append').append(getErrorP(json.error));
                }
                else {
                    document.querySelector('.here_append').append(getSuccessP("User " + args[1] + " added successfully"));
                }
            })).catch(error => {
                document.querySelector('.here_append').append(getErrorP(error));
            })
        }
        else {
            document.querySelector('.here_append').append(getErrorP("Missing arguments. (!add <user>)"));
        }
    }
    else {
        document.querySelector('.here_append').append(getErrorP("Unknown command."));
    }
}