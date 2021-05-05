# Deepgram Video Chat Sample App

This app aims to demonstrate how to use Deepgram stream API to transcribe
voice to text in realtime in a small "Video Chat".

> **WARNING**: This is an example application only designed for demoing. We
> strongly discourage direct use of this code in production environment.

## How can I run it?

### Deploy on Glitch

You can "remix" this application on Glitch:

1. Create an API key in Deepgram, note down the secret.
2. Replace `INSERT_KEY_HERE` and `INSERT_SECRET_HERE`
   with this API key and secret in the following URL:
   > <https://glitch.com/edit/#!/remix/dg-video-chat-example?PORT=3000&DG_KEY=INSERT_KEY_HERE&DG_SECRET=INSERT_SECRET_HERE>

When accessing this URL in your browser, the project will be forked and deployed. Glitch comes with
an online editor so you'll have all the needed tools to play with your own app instance!

### Run on localhost

You can also run this project on your computer. First, grab the repo:

```bash
# Clone this repo
git clone https://github.com/deepgram/talk-time-analytics.git
# move to the created directory
cd talk-time-analytics
# install the dependencies
npm install
```

Then create a file named `.env`, copy-paste the content of the following snippet
replaceing `INSERT_KEY_HERE` and `INSERT_SECRET_HERE` with your API key and secret
(note this is bash-like file, so spaces around `=` are not allowed).

```bash
PORT=3000
DG_KEY=INSERT_KEY_HERE
DG_SECRET=INSERT_SECRET_HERE
```

Finally, launch the project:

```
npm start
```

## How does it work?

The code is mainly split into the server (`server.js`) and the browser (`public/js/video_chat.js`).

### Voice to Text Feature

The browser records the microphone using the [opus-recorder library](https://github.com/chris-rudmin/opus-recorder),
then sends the audio stream to the server. In turns, the server forwards this audio
stream to Deepgram API, using your Deepgram API key to authenticate. When we have
transcription back from Deepgram API, we broadcast this transcription to all the room members.

You could directly connect the browser to Deepgram API, _BUT_ this would ask you disclosing
your Deepgram API key to the browser. Think about it twice before choosing this option.

For more details check out the following functions:

- `setupRealtimeTranscription` in [`server.js`](./server.js),
- `setupRealtimeTranscription` in [`public/js/video_chat.js`](.public/js/video_chat.js).

### Video Chat Feature

The "video chat" feature is implemented through classical WebRTC technology. The server is only
used as a way of establishing a peer to peer connection between two clients Alice and Bob. Once this
peer to peer connection is established, the audio and video stream don't go through the server.

For more details check out the following functions:

- `setupWebRTCSignaling` in [`server.js`](./server.js),
- `createAndSetupPeerConnection` in [`public/js/video_chat.js`](.public/js/video_chat.js).

## Development and Contributing

Interested in contributing? We ❤️ pull requests!

To make sure our community is safe for all, be sure to review and agree to our
[Code of Conduct](./CODE_OF_CONDUCT.md). Then see the
[Contribution](./CONTRIBUTING.md) guidelines for more information.

## Getting Help

We love to hear from you so if you have questions, comments or find a bug in the
project, let us know! You can either:

- [Open an issue](https://github.com/deepgram/video-chat/issues/new) on this repository
- Tweet at us! We're [@DeepgramDevs on Twitter](https://twitter.com/DeepgramDevs)

## Further Reading

Check out the Developer Documentation at [https://developers.deepgram.com/](https://developers.deepgram.com/)
