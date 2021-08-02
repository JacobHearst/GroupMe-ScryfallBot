var HTTPS = require('https');

var botID = process.env.BOT_ID;

function respond() {
  var request = JSON.parse(this.req.chunks[0]),
      botRegex = /\[\[(.+)\]\]/;

  if(request.text && botRegex.test(request.text)) {
    this.res.writeHead(200);
    getCard(response.text.match(botRegex)[0], (cardData) => {
        postMessage(makeMessage(cardData))
    })
    this.res.end();
  } else {
    console.log("No card syntax found");
    this.res.writeHead(200);
    this.res.end();
  }
}

function getCard(cardName, callback) {
    let encodedName = encodeURI(cardName.replace(" ", "+"))

    const options = {
        hostname: 'api.scryfall.com',
        path: `cards/name?fuzzy=${encodedName}`,
        method: 'GET'
    }

    HTTPS.get(options, (response) => {
        let data = '';

        // A chunk of data has been received.
        response.on('data', (chunk) => {
            data += chunk
        })

        response.on('end', () => {
            callback(JSON.parse(data))
        })
    })
    .on("error", (err) => {
        console.error(`Error sending message: ${JSON.stringify(err)}`)
    })
    .on("timeout", (err) => {
        console.error(`Timed out sending message: ${JSON.stringify(err)}`)
    })
}

function makeMessage(cardData) {
    let primaryLink = cardData.scryfall_uri

    if (cardData.image_uris) {
        const uris = cardData.image_uris
        const newLink = uris.normal || uris.large || uris.small
        if (newLink) {
            primaryLink = newLink
        }
    }

    return `${cardData.name}: ${primaryLink}\nView on Scryfall:${cardData.scryfall_uri}`
}

function postMessage(message) {
  var options, body, botReq;

  options = {
    hostname: 'api.groupme.com',
    path: '/v3/bots/post',
    method: 'POST'
  };

  body = {
    "bot_id" : botID,
    "text" : message
  };

  console.log('sending ' + message + ' to ' + botID);

  botReq = HTTPS.request(options, function(res) {
      if(res.statusCode == 202) {
        //neat
      } else {
        console.log('rejecting bad status code ' + res.statusCode);
      }
  });

  botReq.on('error', function(err) {
    console.log('error posting message '  + JSON.stringify(err));
  });
  botReq.on('timeout', function(err) {
    console.log('timeout posting message '  + JSON.stringify(err));
  });
  botReq.end(JSON.stringify(body));
}


exports.respond = respond;