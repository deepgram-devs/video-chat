# Deepgram Video Chat Sample App

This app aims to demonstrate how to use the Deepgram API's streaming endpoint to transcribe
voice to text in realtime in a small "Video Chat".

> **WARNING**: This is an example application only designed for demoing. We
> strongly discourage direct use of this code in a production environment.

## How can I run it?

### Deploy on Glitch

You can "remix" this application on Glitch:

1. Create an API key in Deepgram; make note of the secret.
2. Replace `YOUR_DEEPGRAM_API_KEY` in the following URL with the API Key you created:
   > https://glitch.com/edit/#!/remix/dg-video-chat-example?PORT=3000&DG_KEY=YOUR_DEEPGRAM_API_KEY

When accessing this URL in your browser, the project will be forked and deployed. Glitch comes with
an online editor so you'll have all the needed tools to play with your own app instance!

### Run on localhost

You can also run this project on your computer. First, clone or download the repo:

```bash
# Clone this repo
git clone https://github.com/deepgram-devs/video-chat.git

# Move to the created directory
cd realtime-meeting-transcription
```

Then copy the `.env-example` file into a new file named `.env`, and edit the new file to
reflect the settings you want to use:

- `PORT`: The port on which you want to run the application. You can leave this as port 3000.
- `DG_KEY`: The API Key you created earlier in this tutorial.

(Note that this is a bash-like file, so spaces around `=` are not allowed.)

Next, install the dependencies:

```bash
npm install
```

Finally, launch the project:

```
npm start
```

## How Does it Work?

The code is mainly split into the server (`server.js`) and the browser (`public/js/video_chat.js`).

### Voice to Text Feature

The browser records the microphone using the [opus-recorder library](https://github.com/chris-rudmin/opus-recorder),
then sends the audio stream to the server. In turn, the server forwards this audio
stream to Deepgram's API, using your Deepgram API Key to authenticate. When we receive
transcription back from Deepgram's API, we broadcast the transcription to all the room members.

You could directly connect the browser to Deepgram API, but this would require that you disclose
your Deepgram API Key to the browser. Think twice before choosing this option.

For more details, check out the following functions:

- `setupRealtimeTranscription` in [`server.js`](./server.js),
- `setupRealtimeTranscription` in [`public/js/video_chat.js`](./public/js/video_chat.js).

### Video Chat Feature

The "video chat" feature is implemented through classic WebRTC technology. The server is only
used as a way of establishing a peer-to-peer connection between two clients, Alice and Bob. Once the
peer-to-peer connection is established, the audio and video stream don't go through the server.

For more details, check out the following functions:

- `setupWebRTCSignaling` in [`server.js`](./server.js),
- `createAndSetupPeerConnection` in [`public/js/video_chat.js`](./public/js/video_chat.js).

## Development and Contributing

Interested in contributing? We ❤️ pull requests!

To make sure our community is safe for all, be sure to review and agree to our
[Code of Conduct](./CODE_OF_CONDUCT.md). Then see the
[Contribution](./CONTRIBUTING.md) guidelines for more information.

## Getting Help

We love to hear from you, so if you have questions, comments, or find a bug in the
project, let us know! You can either:

- [Open an issue](https://github.com/deepgram/video-chat/issues/new) in this repository
- Tweet at us! We're [@DeepgramDevs on Twitter](https://twitter.com/DeepgramDevs)

## Further Reading

Check out the Developer Documentation at [https://developers.deepgram.com/](https://developers.deepgram.com/)
