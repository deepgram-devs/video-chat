# Video Chat Live Captioning

[![Remix on Glitch](https://img.shields.io/badge/Glitch-remix-blue?logo=glitch)](#remix-on-glitch)

This app aims to demonstrate how to use the Deepgram API's streaming endpoint
to transcribe voice to text in realtime in a small "Video Chat".

If you launched Glitch directly from a link in Deepgram Console, we have created and implemented a temporary API key for you named ‘video-chat-demo’. This key will expire in 8 hours. If you need to make immediate changes to this app’s access to your Deepgram ASR balance, you can do so by managing your Deepgram API keys in the Deepgram Console under Settings > API Keys. 

Actions taken in Glitch are subject to [Glitch’s Terms of Service and Privacy Policy](https://glitch.com/legal).

## Prerequisites

You will need:

- A [free Deepgram account](https://console.deepgram.com/signup?utm_source=DEVREL&utm_medium=github&utm_content=video-chat)
- A Deepgram [API key](https://developers.deepgram.com/getting-started/create-api-key)

## Getting started

You can run this application by remixing it on Glitch or by running it on your local computer.

### Remix on Glitch

[Glitch](https://glitch.com/) comes with an online editor, so you'll have all the necessary tools to 
explore your own application instance. 

To remix this application on Glitch, go to the following URL:

```text
https://glitch.com/edit/#!/remix/dg-uc-video-chat
```

When accessing this URL in your browser, the project will be forked and deployed.

#### Configure the settings

Your application will need to know more about you before it can run successfully. Edit the environment variables (`.env`) to reflect the settings you want to use:

- `PORT`: The port on which you want to run the application. We generally set this to port 3000.
- `DG_KEY`: The API Key you created earlier in this tutorial.

Once these variables are set, the application should run automatically.

### Run on localhost

You can also run this project on your local computer. To do so, you will need
to clone the repository, configure the settings, install the dependencies, and
start the server.

#### Clone the repository

Either clone or download the repository to your local machine in a new directory:

```bash
# Clone this repo
git clone https://github.com/deepgram-devs/video-chat.git

# Move to the created directory
cd video-chat
```

#### Configure the settings

Your application will need to know more about you before it can run. Copy the
`.env-example` file into a new file named `.env`, and edit the new file to
reflect the settings you want to use:

- `PORT`: The port you wish to run the application on. Leaving this as port 3000
is acceptable.
- `DG_KEY`: The Deepgram API key you created earlier in this tutorial.

#### Install the dependencies

In the directory where you downloaded the code, run the following command to
bring in the dependencies needed for this project:

```bash
npm install
```

#### Start the server

Now that you have configured your application and put the dependencies in place, your application
is ready to go! Run it with:

```bash
npm start
```

## Development and contributing

Interested in contributing? We ❤️ pull requests!

To make sure our community is safe for all, be sure to review and agree to our
[Code of Conduct](./CODE_OF_CONDUCT.md). Then see the
[Contribution](./CONTRIBUTING.md) guidelines for more information.

## Getting help

We love to hear from you, so if you have questions, comments, or find a bug in the
project, let us know! You can either:

- [Open an issue](https://github.com/deepgram-devs/video-chat/issues/new) in this
repository
- Tweet at us! We're [@DeepgramDevs on Twitter](https://twitter.com/DeepgramDevs)

## Further reading

Check out the Developer Documentation at [https://developers.deepgram.com/](https://developers.deepgram.com/).
