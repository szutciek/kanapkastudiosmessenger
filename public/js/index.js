const setup = () => {
    /** @type {WebSocket} */
    var socket;
    const chatView = document.querySelector('.chatView');
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
                sendMessage(input_element.value);
                input_element.value = "";
            }

            if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
                stored_sent_index = Math.max(Math.min(stored_sent_index + (ev.key === "ArrowUp" ? 1 : -1), stored_sent.length - 1), 0);
                fillout();
            }
        }
    });

    const sendMessage = (msg) => {
        if (socket.readyState === socket.OPEN) {
            stored_sent.push(msg);
            stored_sent_index = 0;
            socket.send(JSON.stringify({ path: "message", chat_id: "aaa", message: msg }));
        }
    }

    const createSocket = () => {
        console.log("starting socket");
        socket = new WebSocket('ws://localhost:7777/ws');

        socket.onopen = (ev) => {
            console.log("Socket opened.");
        }

        socket.onmessage = (data) => {
            try {
                const json = JSON.parse(data);

                if (json.path === 'message') {
                    chatView.innerHTML += `<p class="message"><span class="name">${json.username}</span>${json.message}</p>`
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

setup();

function createNewChat() {
    const chat_create = document.createElement('input');
    chat_create.classList.add("chat create");
    chat_create.addEventListener('keydown', e => {
        if (document.activeElement === chat_create) {
            if (e.key === 'enter') {
                fetch('/chat/create', {
                    method: "POST",
                    body: JSON.stringify({
                        chatname: chat_create.value
                    })
                }).then(value => {
                    CreateChat(value.chatname, value.chat_id);
                });
                chat_create.remove();
            }
        }
    })
}

function CreateChat(chatname, chat_id) {
    const chat = document.createElement('button');
    chat.innerText = chatname;
    chat.dataset.chat_id = chat_id;
    chat.addEventListener('click', (e) => {
        showChatContent(chat.dataset.chat_id);
    });
}

function showChatContent(chat_id) {
    fetch('/chat/' + chat_id, {
        method: "GET",
    }).then(value => {
        if (value.error !== undefined) {
            displayError(value.error);
        }
        else {
            displayChatContent(value);
        }
    });
}

function displayError(error) {
    clearChatView();
    const chatView = document.querySelector('.chatView');
    chatView.append(`<p class="message"><span style="color: red;" class="name">Error</span>${error}</p>`);
}

function displayChatContent(chat) {
    clearChatView();
    const chatView = document.querySelector('.chatView');

    const messages = JSON.parse(chat.messages);

    messages.forEach(element => {
        chatView.append(`<p class="message"><span class="name">${element.username}</span>${element.message}</p>`);
    });
}

function clearChatView() {
    const chatView = document.querySelector('.chatView');
    while (chatView.firstChild) {
        chatView.removeChild(chatView.firstChild);
    }
}