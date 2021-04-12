/* The `dotenv` package allows us to load environement
 * variables from the `.env` file. Then, we can access them
 * with `process.env.ENV_VAR_NAME`.
 */
require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const DG_KEY = process.env.DG_KEY;
const DG_SECRET = process.env.DG_SECRET;

if (DG_KEY === undefined || DG_SECRET === undefined) {
  throw "You must define DG_KEY and DG_SECRET in your .env file";
}

// Encode the Deepgram credentials in base64. Will be used to authenticate
// through the Deepgram realtime transcription service.
const DG_CREDENTIALS = Buffer.from(DG_KEY + ":" + DG_SECRET).toString("base64");

const app = express();
let server = http.createServer(app);

/*
 * Basic configuration:
 * - we expose the `/public` folder as a "static" folder, so
 *   browser can directly request js and css files in it.
 * - we send the `/public/index.html` file when the browser requests
 *   any route.
 */
app.use(express.static(__dirname + "/public"));
app.get("*", function (req, res) {
  res.sendFile(`${__dirname}/public/index.html`);
});

const SocketIoServer = require("socket.io").Server;
const Socket = require("socket.io").Socket;
const io = new SocketIoServer(server);
io.sockets.on("connection", handle_connection);

const MAX_CLIENTS = 2;
/**
 * This function will be called every time a client
 * opens a socket with the server. We will define here
 * what to do on reaction to messages sent by clients.
 * @param {Socket} socket */
function handle_connection(socket) {
  const rooms = io.of("/").adapter.rooms;

  socket.on("join", (room) => {
    /**
     *  The `room` parameter comes from the client. Here is a possible user story:
     * - Alice wants to open a new room, so she generates a random string (say "AWSMDG")
     *   which will serve as a room identifier. She sends a `join` message with "AWSMDG" as
     *   parameter to open the room and send this identifier to Bob,
     * - to join the room, Bob has to send this same `join` message with "AWSMDG" as parameter.
     */

    let clientsCount = 0;
    if (rooms[room]) {
      clientsCount = rooms[room].length;
    }
    if (clientsCount >= MAX_CLIENTS) {
      socket.emit("full", room);
    } else {
      socket.join(room);
      socket.broadcast.to(room).emit("user-joined", socket.id);

      setupWebRTCSignaling(socket);
      setupRealtimeTranscription(socket, room);

      socket.on("disconnect", () => {
        socket.broadcast.to(room).emit("bye", socket.id);
      });
    }
  });
}

/**
 * @param {Socket} socket
 * @param {string} room
 */
function setupRealtimeTranscription(socket, room) {
  /** The sampleRate has to match what the client uses. */
  const sampleRate = 16000;
  /**
   * We connect a Websocket to Deepgram server. You can add options in the URL, see the docs:
   * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
   */
  const dgSocket = new WebSocket(
    "wss://brain.deepgram.com/v2/listen/stream?encoding=ogg-opus&sample_rate=" +
      sampleRate +
      "&punctuate=true",
    {
      headers: {
        Authorization: "Basic " + DG_CREDENTIALS,
      },
    }
  );

  /** We have to forward the very first audio packet from the client since
   * it contains some header data needed for audio decoding.
   *
   * So we send a message to the client when the socket to Deepgram is ready
   * thus the client can start sending audio data.
   */
  dgSocket.addEventListener("open", () => socket.emit("can-open-mic"));

  /**
   * We forward the audio stream from client's microphone to Deepgram server.
   */
  socket.on("microphone-stream", (stream) => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(stream);
    }
  });

  /** On Deepgram server message, we forward this response back to all the
   * clients in the room
   */
  dgSocket.addEventListener("message", (event) => {
    io.to(room).emit("transcript-result", socket.id, JSON.parse(event.data));
  });

  /** Close the dsSocket when the client disconnect. */
  socket.on("disconnect", () => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(new Uint8Array(0));
    }
    dgSocket.close();
  });
}

/**
 * Handle the WebRTC "signaling". That means we forward all the needed data from
 * Alice to Bob to establish a peer to peer connection. Once the peer
 * to peer connection is established, the video stream don't go through
 * the server.
 *
 * @param {Socket} socket
 */
function setupWebRTCSignaling(socket) {
  socket.on("video-offer", (id, message) => {
    socket.to(id).emit("video-offer", socket.id, message);
  });
  socket.on("video-answer", (id, message) => {
    socket.to(id).emit("video-answer", socket.id, message);
  });
  socket.on("ice-candidate", (id, message) => {
    socket.to(id).emit("ice-candidate", socket.id, message);
  });
}

const listener = server.listen(process.env.PORT, () =>
  console.log(`Server is running on port ${process.env.PORT}`)
);
