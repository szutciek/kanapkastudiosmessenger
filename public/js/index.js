const setup = () => {
    /** @type {WebSocket} */
    var socket;
    const chatView = document.querySelector('.chatView');
    const submit_parent = document.querySelector('.input');
    const input_element = document.querySelector('input');

    document.addEventListener('keydown', ev => {
        if (ev.key === 'enter' && document.activeElement === input_element) {
            console.log(input_element.value);
            sendMessage(input_element.value);
        }
    });

    const sendMessage = (msg) => {
        if (socket.readyState === socket.OPEN)
            socket.send(JSON.stringify({ path: "message", chat_id: "aaa", message: msg }));
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