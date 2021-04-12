# What is this app for?

This app aims to demonstrate how to use Deepgram stream API to transcribe
voice to text in realtime in a small "Video Chat".

**WARNING**: This is an example application only designed for demoing. We
strongly discourage direct use of this code in production environnement.

# How can I deploy it?

You can "remix" this application on Glitch: replace `INSERT_KEY_HERE` and `INSERT_SECRET_HERE`
with some API key/secret you created on Deepgram.

```
https://glitch.com/edit/#!/remix/dg-video-chat-example?PORT=3000&DG_KEY=INSERT_KEY_HERE&DG_SECRET=INSERT_SECRET_HERE
```

When accessing this URL in your browser, the project will be forked and deployed. Glitch comes with
an online editor so you'll have all the needed tools to play with your own app instance!

# How does it work

The code is mainly split into the server (`server.js`) and the client (`public/js/video_chat.js`).

## Video Chat Feature

The "video chat" feature is implemented through classical WebRTC technology. The server is only
used as a way of establishing a peer to peer connection between two clients Alice and Bob. Once this
peer to peer connection is established, the audio and video stream don't go through the server.

For more details check out the following functions:

- `setupWebRTCSignaling` in `server.js`,
- `createAndSetupPeerConnection` in `public/js/video_chat.js`.

## Transcription Feature

The client sends audio stream to the server. In turns, the server forwards this audio
stream to Deepgram API, using your Deepgram API key to authenticate. When we have
transcription back from Deepgram API, we broadcast this transcription to all the room members.

You could directly connect the client to Deepgram API, _BUT_ this would ask you disclosing
your Deepgram API key to the client. Think about it twice before choosing this option.

For more details check out the following functions:

- `setupRealtimeTranscription` in `server.js`,
- `setupRealtimeTranscription` in `public/js/video_chat.js`.
