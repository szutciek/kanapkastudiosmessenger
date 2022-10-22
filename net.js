const socket = new WebSocket("ws://localhost:7777");

const waitForSocketConnection = (n) => {
    if (n > 500) return;
    if (socket.readyState !== 1) {
        setTimeout(() => waitForSocketConnection(n + 1), 50);
    } else {
        socket.send(JSON.stringify({ type: "GetC" }))
    }
}
waitForSocketConnection(0);

var chat = [];

function goFetch() {
    socket.send(document.getElementById("input").value);
}

socket.addEventListener("message", (data) => {
    try {
        const json = JSON.parse(data.data);
        //console.log(json);
        if (json.type === 'UC') {
            chat = json.body;
            loopAllChat();
        } else if (json.type === 'NC') {
            chat.push(json.body);
            newChat(json.body);
        }
    } catch {}
});

const newChat = (nMsg) => {
    let dd = document.getElementById("output");
    let chatmessage = document.createElement("p");
    chatmessage.className = "txtmsg";
    // chatmessage.readOnly = true;
    chatmessage.innerText = `${nMsg.user}: ${nMsg.message}`;
    setTimeout(() => {
        chatmessage.style.height = chatmessage.scrollHeight + "px";
    }, 1);
    setTimeout(() => {
        dd.scrollTop = dd.scrollHeight;
    }, 2);
    dd.appendChild(chatmessage);
}

const loopAllChat = () => {
    let dd = document.getElementById("output");
    dd.childNodes.forEach(c => c.removeChild());
    chat.forEach(mm => {
        let chatmessage = document.createElement("p");
        chatmessage.className = "txtmsg";
        //chatmessage.readOnly = true;
        chatmessage.innerText = `${mm.user}: ${mm.message}`;
        setTimeout(() => {
            chatmessage.style.height = chatmessage.scrollHeight + "px";
        }, 1);
        setTimeout(() => {
            dd.scrollTop = dd.scrollHeight;
        }, 2);
        dd.appendChild(chatmessage);
    });
}

const sendMessage = () => {
    socket.send(JSON.stringify({ type: "NCM", user: "none", message: document.getElementById("input").value }));
}

window.onkeydown = (e) => {
    if (e.key === "Enter" && document.activeElement.id === "input") {
        sendMessage();
        document.activeElement.value = ""
    }
}