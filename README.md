# ms_fb_google_vision_chatbot
Facebook chatbot built with Microsoft's botframework, that hits the google cloud vision API to extract text from an image and return it.

## Installation

```bash
yarn install
```

## Running it

You need to have some way of making your bot's server (defined in app.js) available at an address.
I use *ngrok* to expose a port in my machine locally that is available via https to the Microsoft Botframework.

After doing that you are going to have to go through the bot setup shenanigans, which are pretty straight forward,
but it took me a bit. I followed the instructions [here](https://github.com/Microsoft/BotBuilder/blob/master/Node/examples/demo-facebook/app.js),
but you can also try to follow [these](https://www.codeproject.com/Articles/1110201/Creating-A-Facebook-Bot-Using-Microsoft-Bot-Framew),
which are a bit more thorough.

##### BRO TIP!
*One of my chrome extensions was messing up with the final step (creating the Microsoft -> FB channel), so just try to follow the instructions above
in an incognito tab first before panicking.*

  1. You need to create a bot with the Microsoft Bot framework. Follow their instructions.
  2. Then create a facebook app for a chatbot following Facebook's instructions.
  3. Then you are going to need to create a facebook page.
  4. Then go into the Microsoft botframework console and setup the Facebook channel for your bot.
  5. Go into your google developers console and create your service key file for the google cloud vision API (they tell you how to do it).

Also, you have to have the following environment variables setup before running.
They all should be available to you after the above is done.
I have them setup in a bash script that I *source* before runing node.

  1. MICROSOFT_APP_ID=
  2. MICROSOFT_APP_PASSWORD=
  3. G_PROJECT_ID=
  4. G_PATH_TO_KEY=


After all of the above is done. Just run the app locally (assuming you have *ngrok* or something similar setup)
and you should be ready to rumble.

```bash
node app.js
```
