(async function () {
  async function main() {
    /* The HTML nodes used for rendering */
    const localVideoNode = document.querySelector("#localVideo");
    const remoteVideoNode = document.querySelector("#remoteVideo");
    const localTranscriptNode = document.querySelector("#localTranscript");
    const remoteTranscriptNode = document.querySelector("#remoteTranscript");
    const startTranscriptButton = document.querySelector(
      "#startTranscriptionButton"
    );
    const shareNode = document.querySelector("#urlShare");
    const editOnGlitchNode = document.querySelector("#editOnGlitch");
    if (
      localVideoNode instanceof HTMLVideoElement &&
      remoteVideoNode instanceof HTMLVideoElement &&
      localTranscriptNode instanceof HTMLElement &&
      remoteTranscriptNode instanceof HTMLElement &&
      startTranscriptButton instanceof HTMLElement &&
      shareNode instanceof HTMLElement &&
      editOnGlitchNode instanceof HTMLAnchorElement
    ) {
      initEditGlitch(editOnGlitchNode);

      const socket = io.connect(window.location.origin);

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });

      localVideoNode.srcObject = localStream;

      initRoom(shareNode, socket);
      setupRemoteVideo(socket, localStream, remoteVideoNode);
      setupMicrophoneTranscription(
        socket,
        localTranscriptNode,
        remoteTranscriptNode,
        startTranscriptButton
      );
    } else {
      console.error("one of the html nodes was not correctly setup");
      return;
    }
  }

  /**
   * @param {SocketIOClient.Socket} socket
   * @param {HTMLElement} localTranscriptNode
   * @param {HTMLElement} remoteTranscriptNode
   * @param {HTMLElement} startTranscriptButton
   */
  function setupMicrophoneTranscription(
    socket,
    localTranscriptNode,
    remoteTranscriptNode,
    startTranscriptButton
  ) {
    const sampleRate = 16000;

    // Configure the recorder.
    const recorder = new Recorder({
      encoderPath: "/js/encoderWorker.min.js",
      leaveStreamOpen: true,
      numberOfChannels: 1,

      // OPUS options
      encoderSampleRate: sampleRate,
      streamPages: true,
      maxBuffersPerPage: 1,
    });

    startTranscriptButton.addEventListener("click", (event) => {
      recorder.start();
      startTranscriptButton.remove();
    });

    /**
     * @param {{ buffer: any; }} e
     */
    recorder.ondataavailable = (e) => {
      if (socket.connected) {
        socket.emit("microphone-stream", e.buffer);
      }
    };

    const localTranscript = new Transcript();
    const remoteTranscript = new Transcript();
    /**
     * @param {string} socketId
     * @param {any} jsonFromServer
     */
    socket.on("transcript-result", (socketId, jsonFromServer) => {
      console.log("received:", socketId, "our socket id:", socket.id);
      if (socketId === "/#" + socket.id) {
        localTranscript.addServerAnswer(jsonFromServer);

        localTranscriptNode.innerHTML = "";
        localTranscriptNode.appendChild(localTranscript.toHtml());
      } else {
        remoteTranscript.addServerAnswer(jsonFromServer);

        remoteTranscriptNode.innerHTML = "";
        remoteTranscriptNode.appendChild(remoteTranscript.toHtml());
      }
    });
  }

  class Transcript {
    constructor() {
      /** @type {Map<number, {words: string, is_final: boolean}>} */
      this.chunks = new Map();
    }

    /** @argument {any} jsonFromServer */
    addServerAnswer(jsonFromServer) {
      this.chunks.set(jsonFromServer.start, {
        words: jsonFromServer.channel.alternatives[0].transcript,
        is_final: jsonFromServer.is_final,
      });
    }

    /** @returns {HTMLElement} */
    toHtml() {
      const divNode = document.createElement("div");
      divNode.className = "transcript-text";
      [...this.chunks.entries()]
        .sort((entryA, entryB) => entryA[0] - entryB[0])
        .forEach((entry) => {
          const spanNode = document.createElement("span");
          spanNode.innerText = entry[1].words;
          spanNode.className = entry[1].is_final ? "final" : "interim";
          divNode.appendChild(spanNode);
          divNode.appendChild(document.createTextNode(" "));
        });

      return divNode;
    }
  }

  /**
   * Setup all the needed subscriptions on the socket to display
   * the remote video in remoteVideoNode.
   *
   * The websocket is NOT used to forward the video stream, it is only used to forward
   * data to the peer in order to establish a peer to peer connection. Then the video
   * and audio streams will be transfered through this peer to peer connection.
   *
   * @param {SocketIOClient.Socket} socket This socket has to be "room initialized"
   *                                       with a call like `initRoom(socket)`.
   * @param {MediaStream} localStream
   * @param {HTMLVideoElement} remoteVideoNode
   */
  function setupRemoteVideo(socket, localStream, remoteVideoNode) {
    /**
     * Will be used to track all the peer to peer
     * connections we'll have with other clients.
     * @type {Map<string, RTCPeerConnection>}
     */
    const allPeerConnections = new Map();

    /**
     * Suppose Alice is already connected. She sends to Bob
     * her link.
     */

    /**
     * Then Bob joins the same room than Alice, so Alice
     * receives a "user-joined" message with `peerSocketId`
     * being Bob's identifier.
     * Then Alice will:
     * - create a new RTC connection,
     * - when the connection is ready, send a "video-offer" message to Bob
     *   with the needed data to setup its own RTC connection.
     */
    /**
     * @param {string} peerSocketId
     */
    socket.on("user-joined", (peerSocketId) => {
      // This function is executed by Alice.
      const peerConnection = createAndSetupPeerConnection(
        peerSocketId,
        localStream,
        remoteVideoNode,
        socket,
        allPeerConnections
      );

      peerConnection.onnegotiationneeded = async () => {
        const sessionDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(sessionDescription);
        socket.emit(
          "video-offer",
          peerSocketId,
          peerConnection.localDescription
        );
      };
    });

    /**
     * After that, Bob receives this "video-offer" message. He will:
     * - create our own RTC connection,
     * - intialize it with the description he received,
     * - send back a "video-answer" message" to Alice.
     */
    /**
     * @param {string} peerSocketId
     * @param {RTCSessionDescriptionInit} description
     */
    socket.on("video-offer", async (peerSocketId, description) => {
      // This function is executed by Bob.
      const peerConnection = createAndSetupPeerConnection(
        peerSocketId,
        localStream,
        remoteVideoNode,
        socket,
        allPeerConnections
      );

      await peerConnection.setRemoteDescription(description);
      const sessionDescription = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(sessionDescription);

      socket.emit(
        "video-answer",
        peerSocketId,
        peerConnection.localDescription
      );
    });

    /**
     * Thus Alice will receive this "video-answer" message.
     * She will use this description to finalize the peer
     * connection configuration.
     */
    /**
     * @param {string} peerSocketId
     * @param {RTCSessionDescriptionInit} description
     */
    socket.on("video-answer", (peerSocketId, description) => {
      // This function is executed by Alice.
      allPeerConnections.get(peerSocketId).setRemoteDescription(description);
    });

    /**
     * An ICE candidate describes what video/audio format can be
     * used. We just have to forward these candidates to the corresponding
     * peer connection which will take care of comparing this
     * candidate with what it can handle.
     */
    /**
     * @param {string} peerSocketId
     * @param {RTCIceCandidateInit} candidate
     */
    socket.on("ice-candidate", (peerSocketId, candidate) => {
      // This function is executed by Alice & Bob.
      allPeerConnections
        .get(peerSocketId)
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((e) => console.error(e));
    });

    /** A client in the root has left, we close the corresponding
     * connection
     */
    /**
     * @param {string} peerSocketId
     */
    socket.on("bye", (peerSocketId) => {
      // This function is executed by Alice or Bob.
      allPeerConnections.get(peerSocketId)?.close();
      allPeerConnections.delete(peerSocketId);
      remoteVideoNode.srcObject = null;
    });
  }

  /**
   * Retreive the room id and make the socket
   * the corresponding room
   * @param {HTMLElement} shareNode
   * @param {SocketIOClient.Socket} socket
   */
  function initRoom(shareNode, socket) {
    /**
     * The room Id is specified in the path.
     * We expect having something like `/{roomId}`.
     * In case of no room id in the URL, we generate a random one
     * and update the url in the navigation bar (without adding
     * a new entry in the history).
     */
    const roomRequested = location.pathname.substring(1);
    const room = roomRequested == "" ? randomId() : roomRequested;
    window.history.replaceState(null, "Video Chat", "/" + room);
    shareNode.innerText = location + "";

    socket.emit("join", room);
    socket.on("full", (room) => {
      alert("Room " + room + " is full");
    });
  }

  /**
   * Modify the "Edit on Glitch" tag to point to the
   * Glitch editor.
   * @param {HTMLAnchorElement} editOnGlitchNode
   */
  function initEditGlitch(editOnGlitchNode) {
    const [subdomain, ...domain] = location.host.split(".");
    if (domain.length === 2 && domain[0] === "glitch" && domain[1] === "me") {
      editOnGlitchNode.href = "https://glitch.com/edit/#!/" + subdomain;
    } else {
      editOnGlitchNode.remove();
    }
  }

  /**
   * @returns {string} */
  function randomId() {
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var result = "";
    for (var i = 0; i < 10; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  /**
   * Create a RTC peer connection and:
   * - add this connection to `allPeerConnections`,
   * - add the local stream as a outgoing tracks to the peer connection
   *   so the local stream can be send to the peer,
   * - conversely, bind the incoming tracks to remoteVideoNode.srcObject
   *   so we can see the peer's stream,
   * - forward ICE candidates to the peer through the socket. This is
   *   required by the RTC protocol to make both clients agree on what
   *   video/audio format and quality using.
   * @param {string} peerSocketId
   * @param {MediaStream} localStream
   * @param {HTMLVideoElement} remoteVideoNode
   * @param {SocketIOClient.Socket} socket
   * @param {Map<string, RTCPeerConnection>} allPeerConnections
   * @returns {RTCPeerConnection} */
  function createAndSetupPeerConnection(
    peerSocketId,
    localStream,
    remoteVideoNode,
    socket,
    allPeerConnections
  ) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: ["stun:stun.l.google.com:19302"],
        },
      ],
    });
    allPeerConnections.set(peerSocketId, peerConnection);

    localStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", peerSocketId, event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideoNode.srcObject = event.streams[0];
    };

    return peerConnection;
  }

  main();
})();
