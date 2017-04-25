var restify = require('restify');
var builder = require('botbuilder');
var Datauri = require('datauri');
var base64Img = require('base64-img');

var {
  G_PROJECT_ID,
  G_PATH_TO_KEY,
} = process.env;

var config = {
  projectId: G_PROJECT_ID,
  keyFilename: G_PATH_TO_KEY,
};

var vision = require('@google-cloud/vision')(config);

var tap = r => { console.log(r); return r; };
var promiseBase64FromURL = (url) => new Promise((resolve, reject) => {
    base64Img.requestBase64(url, function(err, res, datauri) {
      if (!err) {
        resolve(datauri.split(',')[1]);
      } else {
        reject(err);
      }
    });
});
var buildAnnotateImageRequest = (base64) => ({
  features: [
    {
      type: 'DOCUMENT_TEXT_DETECTION',
    },
    {
      type: 'TEXT_DETECTION',
    },
  ],
  imageContext: {
    languageHints: [
      'es',
      'en',
    ],
  },
  image: {
    content: base64,
  },
});
var safeGet = (obj, prop) => obj[prop] || {};
var firstAnnotation = r => safeGet(safeGet(r, 0), 0);

//r.textAnnotations

//console.log(JSON.stringify(r[0][0].textAnnotations));

// test in console by running these
//var extract = r => { global.r = r; console.log(r); return r; };
////var imgPath = 'https://scontent.xx.fbcdn.net/v/t35.0-12/18159798_10211192586763449_813895164_o.jpg?_nc_ad=z-m&oh=0ed5b041ad46933ce9c8e906c3bfe5a7&oe=59027502';
////
//var imgPath = 'https://scontent.xx.fbcdn.net/v/t35.0-12/18159464_10211192684885902_1984437387_o.jpg?_nc_ad=z-m&oh=ffd2d9e6be027600c67badac92ef90ef&oe=5902039E'
//var imgPath = 'https://scontent.xx.fbcdn.net/v/t35.0-12/18160105_10211193026894452_1154707846_o.jpg?_nc_ad=z-m&oh=5ec9b54b8def5286d8fe523f4e05cc9b&oe=59020ADF';

//promiseBase64FromURL(imgPath).then((base64) => {
    //var visionRequest = buildAnnotateImageRequest(base64);
    //return vision.annotate(visionRequest).then(firstAnnotation);
  //}).then(extract, extract);

//promiseBase64FromURL(imgPath).then(buildAnnotateImageRequest).then(r => vision.annotate(r)).then(extract, extract);

//r


////var imgPath = '../t.jpg';
////var base64 = (new Datauri(imgPath)).base64

//var visionRequest = buildAnnotateImageRequest(base64);
//vision.annotate(visionRequest).then(firstAnnotation).then(extract, extract);

//r.fullTextAnnotation
//r.textAnnotations


var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
  console.log('%s listening to %s', server.name, server.url);
});

var connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD,
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//===
// Bot's middleware
//===

bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^rest/i }));

//===
// Bot's Global Actions
//===

bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });

//===
// Bot's Dialogs
//===

bot.dialog('/', [
  function (session) {
    const card = new builder.HeroCard(session)
      .title("Microsoft Bot Framework")
      .text("Your bots - where your users are talking.")
      .images([
        builder
          .CardImage
          .create(session, 'http://placekitten.com/1024/1024')
      ]);
    const msg = new builder.Message(session).attachments([card]);
    session.send(msg);
    session.send(
      "Hi... I'm the Microsoft Bot Framework demo bot for Facebook. I can show you everything you can use our Bot Builder SDK to do on Facebook."
    );
    session.beginDialog('/help');
  },
  function (session, results) {
    session.beginDialog('/menu');
  },
  function (session, results) {
    session.send("Ok... See you later!");
  }
]);

bot.dialog('/menu', [
  function (session) {
    builder.Prompts
      .choice(
        session,
        "Qué quieres hacer?", "analizar imagen|prompts|picture|cards|list|carousel|receipt|actions|(quit)"
      );
  },
  function (session, results) {
    if (!results || results.response.entity === '(quit)') {
      session.endDialog();
      return;
    }

    session.beginDialog('/' + results.response.entity);
  },
  function (session, results) {
    session.replaceDialog('/menu');
  },
]).reloadAction('reloadMenu', null, { matches: /^menu|show menu/i });

const helpText = `\
Global commands that are available anytime:


* menu - Exits a demo and returns to the menu.
* goodbye - End this conversation
* help - displays these commands.\
`;
bot.dialog('/help', [
  function (session) {
    session.endDialog(helpText);
  },
]);

bot.dialog('/analizar imagen', [
  function (session) {
    builder.Prompts.attachment(session, "Envíame una imágen de un ticket y te diré que veo :P.");
  },
  function (session, results) {
    let msg = new builder.Message(session)
      .ntext("Obtuve %d imágen", "Obtuve %d imágenes", results.response.length);
    session.send(msg);
    const processedImages = results.response.map((attachment) => {
      const { contentUrl } = attachment;
      console.log(contentUrl);
      return promiseBase64FromURL(contentUrl)
        .then(r => { console.log(r.substring(0, 100)); return r;})
        .then(buildAnnotateImageRequest)
        .then(r => { console.log(Object.keys(r)); return r;})
        .then(r => vision.annotate(r))
        .then(tap)
        .then(firstAnnotation);
    });

    //r.fullTextAnnotation
    //r.textAnnotations
    Promise.all(processedImages).then((imagesAnnotations) => {
      imagesAnnotations.forEach((a) => {
        msg = new builder.Message(session)
          .ntext("Encontré %d sección con texto", "Encontré %d secciones de texto", a.textAnnotations.length);
        session.send(msg);
        session.send(a.fullTextAnnotation);
      });
      session.endDialog('Esas son todas las imagenes.');
    });

  },
]);

const echo = function (s, r, path = ['response']) {
  const response = path.reduce((obj, attr) => obj[attr], r);
  const responseStr = typeof(response) !== 'string' ?
    JSON.stringify(response) : response;
  s.send(`You entered ${responseStr}`);
}

bot.dialog('/prompts', [
  function (session) {
    session.send(`Our Bot Builder SDK has a rich set of built-in prompts that simplify asking the user a series of questions. This demo will walk you through using each prompt. Just follow the prompts and you can quit at any time by saying 'cancel'.`);
    builder.Prompts.text(session, "Prompts.text()\n\nEnter some text and I'll say it back.");
  },
  function (session, results) {
    echo(session, results);
    builder.Prompts.number(session, 'Prompts.number()\n\nNow enter a number.');
  },
  function (session, results) {
    echo(session, results);
    builder.Prompts.choice(session, "Prompts.choice()\n\nChoose a list style (the default is auto.)", "auto|inline|list|button|none");
  },
  function (session, results) {
    const style = builder.ListStyle[results.response.entity];
    builder.Prompts.choice(session, "Prompts.choice()\n\nNow pick an option.", "option A|option B|option C", { listStyle: style });
  },
  function (session, results) {
    echo(session, results, ['response', 'entity']);
    builder.Prompts.confirm(session, "Prompts.confirm()\n\nSimple yes/no questions are possible. Answer yes or no now.");
  },
  function (session, results) {
    echo(session, results);
    builder.Prompts.time(session, "Prompts.time()\n\nThe framework can recognize a range of times expressed as natural language. Enter a time like 'Monday at 7am' and I'll show you the JSON we return.");
  },
  function (session, results) {
    echo(session, results);
    builder.Prompts.attachment(session, "Prompts.attachment()\n\nYour bot can wait on the user to upload an image or video. Send me an image and I'll send it back to you.");
  },
  function (session, results) {
    const msg = new builder.Message(session)
      .ntext("I got %d attachment.", "I got %d attachments.", results.response.length);
    results.response.forEach((attachment) => {
      msg.addAttachment(attachment);
    });
    session.endDialog(msg);
  },
]);

bot.dialog('/picture', [
  function (session) {
    session.send("You can easily send pictures to a user...");
    var msg = new builder.Message(session)
      .attachments([{
        contentType: "image/jpeg",
        contentUrl: "http://www.theoldrobots.com/images62/Bender-18.JPG"
      }]);
    session.endDialog(msg);
  },
]);

bot.dialog('/cards', [
  function (session) {
    session.send("You can use either a Hero or a Thumbnail card to send the user visually rich information. On FB both will be rendered using the same Generic Template...");

    const msg = new builder.Message(session)
      .attachments([
        new builder.HeroCard(session)
          .title("Hero Card")
          .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
          .images([
            builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
          ])
          .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle"))
      ]);
    session.send(msg);
    msg = new builder.Message(session)
      .attachments([
        new builder.ThumbnailCard(session)
          .title("Thumbnail Card")
          .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
          .images([
            builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
          ])
          .tap(
            builder.CardAction.openUrl(
              session, "https://en.wikipedia.org/wiki/Pike_Place_Market"
            )
          )
      ]);
    session.endDialog(msg);
  },
]);

bot.dialog('/carousel', [
  function (session) {
    session.send("You can pass a custom message to Prompts.choice() that will present the user with a carousel of cards to select from. Each card can even support multiple actions.");
    const msg = new builder.Message(session)
      .attachmentLayout(builder.AttachmentLayout.carousel)
      .attachments([
        new builder.HeroCard(session)
          .title("Space Needle")
          .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
          .images([
            builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
            .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/800px-Seattlenighttimequeenanne.jpg")),
          ])
        .buttons([
          builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle", "Wikipedia"),
          builder.CardAction.imBack(session, "select:100", "Select")
        ]),
      new builder.HeroCard(session)
        .title("Pikes Place Market")
        .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
        .images([
            builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
              .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/800px-PikePlaceMarket.jpg")),
        ])
        .buttons([
          builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Pike_Place_Market", "Wikipedia"),
          builder.CardAction.imBack(session, "select:101", "Select")
        ]),
      new builder.HeroCard(session)
        .title("EMP Museum")
        .subtitle("EMP Musem is a leading-edge nonprofit museum, dedicated to the ideas and risk-taking that fuel contemporary popular culture.")
        .images([
          builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Night_Exterior_EMP.jpg/320px-Night_Exterior_EMP.jpg")
            .tap(builder.CardAction.showImage(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Night_Exterior_EMP.jpg/800px-Night_Exterior_EMP.jpg"))
        ])
        .buttons([
          builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/EMP_Museum", "Wikipedia"),
          builder.CardAction.imBack(session, "select:102", "Select")
        ])
      ]);
    builder.Prompts.choice(session, msg, "select:100|select:101|select:102");
  },
  function (session, results) {
    let action, item;
    const kvPair = results.response.entity.split(':');
    switch (kvPair[0]) {
      case 'select':
        action = 'selected';
        break;
    }
    switch (kvPair[1]) {
      case '100':
        item = 'the Space Needle';
        break;
      case '101':
        item = 'Pikes Place Market';
        break;
      case '102':
        item = 'the EMP Museum';
        break;
    }
    session.endDialog('You %s "%s"', action, item);
  },
]);

bot.dialog('/receipt', [
  function (session) {
    session.send('You can send a receipts for facebook using Bot Builders ReceiptCard...');
    let msg = new builder.Message(session)
      .attachments([
        new builder.ReceiptCard(session)
          .title("Receipient's Name")
          .items([
            builder.ReceiptItem.create(session, "$22.00", "EMP Museum").image(builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/a/a0/Night_Exterior_EMP.jpg")),
            builder.ReceiptItem.create(session, "$22.00", "Space Needle").image(builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/7/7c/Seattlenighttimequeenanne.jpg"))

          ])
          .facts([
            builder.Fact.create(session, '1234567898', 'Order Number'),
            builder.Fact.create(session, 'VISA 4076', 'Payment Method'),
          ])
          .tax('$4.40')
          .total('$48.40')
      ])
    session.send(msg);

    session.send('Or using facebooks native attachment schema...');
    msg = new builder.Message(session)
      .sourceEvent({
        facebook: {
          attachment: {
            type: "template",
            payload: {
              template_type: "receipt",
              recipient_name: "Stephane Crozatier",
              order_number: "12345678902",
              currency: "USD",
              payment_method: "Visa 2345",
              order_url: "http://petersapparel.parseapp.com/order?order_id=123456",
              timestamp: "1428444852",
              elements: [
                {
                  title: "Classic White T-Shirt",
                  subtitle: "100% Soft and Luxurious Cotton",
                  quantity: 2,
                  price: 50,
                  currency: "USD",
                  image_url: "http://petersapparel.parseapp.com/img/whiteshirt.png"
                },
                {
                  title: "Classic Gray T-Shirt",
                  subtitle: "100% Soft and Luxurious Cotton",
                  quantity: 1,
                  price: 25,
                  currency: "USD",
                  image_url: "http://petersapparel.parseapp.com/img/grayshirt.png"
                }
              ],
              address: {
                street_1: "1 Hacker Way",
                street_2: "",
                city: "Menlo Park",
                postal_code: "94025",
                state: "CA",
                country: "US"
              },
              summary: {
                subtotal: 75.00,
                shipping_cost: 4.95,
                total_tax: 6.19,
                total_cost: 56.14
              },
              adjustments: [
                { name: "New Customer Discount", amount: 20 },
                { name: "$10 Off Coupon", amount: 10 },
              ],
            }
          }
        }
      })
    session.endDialog(msg);
  }
]);

bot.dialog('/actions', [
  function (session) {
    session.send("Bots can register global actions, like the 'help' & 'goodbye' actions, that can respond to user input at any time. You can even bind actions to buttons on a card.");

    var msg = new builder.Message(session)
      .attachments([
        new builder.HeroCard(session)
          .title("Space Needle")
          .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
          .images([
            builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
          ])
          .buttons([
            builder.CardAction.dialogAction(session, "weather", "Seattle, WA", "Current Weather")
          ])
      ]);
    session.send(msg);

    session.endDialog("The 'Current Weather' button on the card above can be pressed at any time regardless of where the user is in the conversation with the bot. The bot can even show the weather after the conversation has ended.");
  },
]);

bot.dialog('/weather', [
  function (session, args) {
    session.endDialog('The weather in %s is 71 degrees and raining.', args.data);
  },
]);

bot.beginDialogAction('weather', '/weather');
