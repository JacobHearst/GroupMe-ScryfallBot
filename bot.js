var HTTPS = require('https');
var Stream = require('stream').Transform

var botID = process.env.BOT_ID;
var accessToken = process.env.GM_TOKEN

function respond() {
    var request = JSON.parse(this.req.chunks[0])
    var botRegex = /\[\[(.+)\]\]/;

    console.log(request)

    if (request.text && botRegex.test(request.text)) {
        this.res.writeHead(200);
        getCard(request.text.match(botRegex)[1], postMessage)
        this.res.end();
    } else {
        console.log("No card syntax found");
        this.res.writeHead(200);
        this.res.end();
    }
}

function getCard(cardName, callback) {
    console.log(`Getting card with name: ${cardName}`)
    const encodedName = encodeURI(cardName.replace(" ", "+"))

    HTTPS.get(`https://api.scryfall.com/cards/named?fuzzy=${encodedName}`, (response) => {
        let data = '';

        // A chunk of data has been received.
        response.on('data', (chunk) => {
            data += chunk
        })

        response.on('end', () => {
            const responseBody = JSON.parse(data)
            if (responseBody.status > 200) {
                console.error(`Scryfall request failed: ${responseBody.details}`)
            } else {
                callback(responseBody)
            }
        })
    })
        .on("error", (err) => {
            console.error(`Error sending message: ${JSON.stringify(err)}`)
        })
        .on("timeout", (err) => {
            console.error(`Timed out sending message: ${JSON.stringify(err)}`)
        })
}

function uploadImageToGroupMe(uri, callback) {
    HTTPS.get(uri, (response) => {
        var data = new Stream();
        response.on('data', (chunk) => { data.push(chunk) })
        response.on('end', () => {
            const options = {
                hostname: 'image.groupme.com',
                port: 443,
                path: '/pictures',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/jpeg',
                    'X-Access-Token': accessToken
                }
            }

            const req = HTTPS.request(options, res => {
                let groupMeData = ""

                res.on('data', d => {
                    groupMeData += d
                })

                res.on('end', () => {
                    callback(JSON.parse(groupMeData))
                })
            })

            req.on('error', error => {
                console.error(error)
            })

            req.write(data.read())
            req.end()
        })
    })
}

function postMessage(cardData) {
    let options = {
        hostname: 'api.groupme.com',
        path: '/v3/bots/post',
        method: 'POST'
    };

    let body = {
        "bot_id": botID,
        "text": `View on Scryfall: ${cardData.scryfall_uri}`,
    };

    const image_uris = cardData.image_uris
    if (image_uris && (image_uris.normal || image_uris.large || image_uris.small)) {
        uploadImageToGroupMe(image_uris.normal || image_uris.large || image_uris.small, (response) => {
            body.attachments = [
                {
                    "type": "image",
                    "url": response.payload.picture_url
                }
            ]

            console.log('sending ' + body.text + ' to ' + botID);

            botReq = HTTPS.request(options, function (res) {
                let resData = ""
                if (res.statusCode == 202) {
                    //neat
                } else {
                    console.log('rejecting bad status code ' + res.statusCode);
                }

                res.on("data", (data) => resData += data)
                res.on("end", () => console.log(resData))
            });

            botReq.on('error', function (err) {
                console.log('error posting message ' + JSON.stringify(err));
            });
            botReq.on('timeout', function (err) {
                console.log('timeout posting message ' + JSON.stringify(err));
            });
            botReq.end(JSON.stringify(body));
        })
    } else {
        console.log(`No images for card: ${cardData.name}`)
    }
}


exports.respond = respond;