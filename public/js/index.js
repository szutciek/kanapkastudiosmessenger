const setup = () => {
    /** @type {WebSocket} */
    var socket;

    const createSocket = () => {
        socket = new WebSocket('ws://localhost:7777/ws');

        socket.onopen = (ev) => {
            console.log("Socket opened.");
        }

        socket.onmessage = (data) => {
            
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
}