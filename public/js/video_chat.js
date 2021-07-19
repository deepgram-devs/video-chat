(async function () {
  async function main() {
    /* The HTML nodes used for rendering. */
    const localVideoNode = document.querySelector("#localVideo");
    const remoteVideoNode = document.querySelector("#remoteVideo");
    const localTranscriptNode = document.querySelector("#localTranscript");
    const remoteTranscriptNode = document.querySelector("#remoteTranscript");
    const shareNode = document.querySelector("#urlShare");
    const editOnGlitchNode = document.querySelector("#editOnGlitch");
    if (
      localVideoNode instanceof HTMLVideoElement &&
      remoteVideoNode instanceof HTMLVideoElement &&
      localTranscriptNode instanceof HTMLElement &&
      remoteTranscriptNode instanceof HTMLElement &&
      shareNode instanceof HTMLElement &&
      editOnGlitchNode instanceof HTMLAnchorElement
    ) {
      initEditGlitch(editOnGlitchNode);

      const socket = io.connect(window.location.origin);

      // Request access to the user's microphone and camera.
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: "user" },
        });
      } catch {
        alert(
          "No microphone found. Please activate your microphone and refresh the page."
        );
        return;
      }

      localVideoNode.srcObject = localStream;

      initRoom(shareNode, socket);
      setupRemoteVideo(socket, localStream, remoteVideoNode);
      setupRealtimeTranscription(
        socket,
        localTranscriptNode,
        remoteTranscriptNode
      );
    } else {
      console.error("one of the HTML nodes was not set up correctly");
      return;
    }
  }

  /**
   * @param {SocketIOClient.Socket} socket
   * The socket used to send the audio stream and get back the transcription.
   * @param {HTMLElement} localTranscriptNode
   * The HTML node used to display the local transcription.
   * @param {HTMLElement} remoteTranscriptNode
   * The HTML node used to display the remote transcription.
   */
  function setupRealtimeTranscription(
    socket,
    localTranscriptNode,
    remoteTranscriptNode
  ) {
    const sampleRate = 16000;

    // Configure the recorder. The "Recorder" value is loaded in `index.html`
    // with the <script src="/js/recorder.min.js"> tag.
    const recorder = new Recorder({
      encoderPath: "/js/encoderWorker.min.js",
      leaveStreamOpen: true,
      numberOfChannels: 1,

      // OPUS options
      encoderSampleRate: sampleRate,
      streamPages: true,
      maxBuffersPerPage: 1,
    });

    /** We must forward the very first audio packet from the client because
     * it contains some header data needed for audio decoding.
     *
     * Thus, we must wait for the server to be ready before we start recording.
     */
    socket.on("can-open-mic", () => {
      recorder.start();
    });

    /** We forward our audio stream to the server. */
    recorder.ondataavailable = (e) => {
      socket.emit("microphone-stream", e.buffer);
    };

    const localTranscript = new Transcript();
    const remoteTranscript = new Transcript();

    /** As Deepgram returns real-time transcripts, we display them back in the DOM.
     * @param {string} socketId
     * @param {any} jsonFromServer
     */
    socket.on("transcript-result", (socketId, jsonFromServer) => {
      if (socketId === socket.id) {
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

  /** The server will send multiple messages that correspond to
   * the same chunk of audio, improving the transcription on each
   * message. The following class is a helper to keep track
   * of the current state of the transcript.
   */
  class Transcript {
    constructor() {
      /** @type {Map<number, {words: string, is_final: boolean}>} */
      this.chunks = new Map();
    }

    /** @argument {any} jsonFromServer */
    addServerAnswer(jsonFromServer) {
      const words = JSON.parse(jsonFromServer).channel.alternatives[0]
        .transcript;
      if (words !== "") {
        this.chunks.set(jsonFromServer.start, {
          words,
          // if "is_final" is true, we will never have future updates for this
          // audio chunk.
          is_final: jsonFromServer.is_final,
        });
      }
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
   * Sets up the needed subscriptions on the socket to display
   * the remote video in remoteVideoNode.
   *
   * The websocket is NOT used to forward the video stream; it only forwards data to
   * the peer to establish a peer-to-peer connection through which the video and
   * audio streams will be transferred.
   *
   * @param {SocketIOClient.Socket} socket
   * This socket has to be "room initialized" with a call like `initRoom(socket)`.
   * @param {MediaStream} localStream
   * @param {HTMLVideoElement} remoteVideoNode
   */
  function setupRemoteVideo(socket, localStream, remoteVideoNode) {
    /**
     * Will be used to track all the peer-to-peer
     * connections we'll have with other clients.
     * @type {Map<string, RTCPeerConnection>}
     */
    const allPeerConnections = new Map();

    /**
     * Suppose we have two clients: Alice and Bob. Alice has already connected. She
     * sends her link to Bob.
     *
     * Bob uses the link to join the same room as Alice, so Alice receives a
     * "user-joined" message; `peerSocketId` is  Bob's identifier.
     *
     * Alice will then:
     * - create a new RTC connection
     * - when the connection is ready, send a "video-offer" message to Bob that contains
     *   the necessary data to set up his own RTC connection.
     *
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
     * Bob receives the "video-offer" message. He will:
     * - create his own RTC connection
     * - initialize it with the description he received from Alice
     * - send back a "video-answer" message" to Alice
     *
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
     * Alice receives the "video-answer" message from Bob.
     * She uses the contained description to finalize the peer
     * connection configuration.
     *
     * @param {string} peerSocketId
     * @param {RTCSessionDescriptionInit} description
     */
    socket.on("video-answer", (peerSocketId, description) => {
      // This function is executed by Alice.
      allPeerConnections.get(peerSocketId).setRemoteDescription(description);
    });

    /**
     * An ICE candidate describes what video/audio format can be
     * used. We just must forward these candidates to the corresponding
     * peer connection, which will take care of comparing this
     * candidate with what it can handle.
     *
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
     * connection.
     *
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
   * Retrieves the room ID and makes the socket
   * the corresponding room.
   *
   * @param {HTMLElement} shareNode
   * @param {SocketIOClient.Socket} socket
   */
  function initRoom(shareNode, socket) {
    /**
     * The room ID is specified in the path. We expect something like `/{roomId}`.
     *
     * In case there is no room ID in the URL, we generate a random one
     * and update the URL in the navigation bar (without adding
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
   *
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
   * - add this connection to `allPeerConnections`
   * - add the local stream as outgoing tracks to the peer connection
   *   so the local stream can be sent to the peer
   * - conversely, bind incoming tracks to remoteVideoNode.srcObject,
   *   so we can see the peer's stream
   * - forward ICE candidates to the peer through the socket. This is
   *   required by the RTC protocol to make both clients agree on what
   *   video/audio format and quality to use.
   *
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
