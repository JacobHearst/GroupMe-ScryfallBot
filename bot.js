var HTTPS = require("https");
var Stream = require("stream").Transform

var botID = process.env.BOT_ID;
var accessToken = process.env.GM_TOKEN

function respond() {
    const request = JSON.parse(this.req.chunks[0])
    const botRegex = /\[\[([^\[\]]+)\]\]/g
    const matches = request.text.match(botRegex)

    if (request.text && matches) {
        this.res.writeHead(200);
        matches.forEach((match) => {
            const cleanMatch = match.replace("[[", "").replace("]]", "")
            getCard(cleanMatch, (cardData) => postCardDetails(cardData, cleanMatch))
        })
        this.res.end();
    } else {
        console.log("No card syntax found");
        this.res.writeHead(200);
        this.res.end();
    }
}

function getCard(cardName, callback) {
    console.log(`Getting card with name: ${cardName}`)
    const encodedName = encodeURI(cardName)

    HTTPS.get(`https://api.scryfall.com/cards/named?fuzzy=${encodedName}`, (response) => {
        let data = "";

        response.on("data", (chunk) => {
            data += chunk
        })

        response.on("end", () => {
            const responseBody = JSON.parse(data)
            if (responseBody.status > 400) {
                const text = `Scryfall request failed: ${responseBody.details}`
                postMessage({ text })
                console.error(text)
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

function postCardDetails(cardData, faceName) {
    const image_uris = cardData.image_uris
    let image_uri = undefined

    if (image_uris && !!selectImageUri(image_uris)) {
        image_uri = selectImageUri(image_uris)
    } else if (cardData.card_faces) {
        image_uri = getMultifaceCardArt(cardData, faceName)
    } else {
        const text = `No images for card: ${cardData.name}` 
        console.warn(text)
        postMessage({ text })
    }

    if (!!image_uri) {
        uploadImageToGroupMe(image_uri, (response) => {
            body = {
                text: `Scryfall: ${cardData.scryfall_uri}`,
                attachments: [
                    {
                        "type": "image",
                        "url": response.payload.picture_url
                    }
                ]
            }

            postMessage(body)
        })
    }
}

function getMultifaceCardArt(cardData, faceName) {
    // Try to get the art for the specified face
    let face = cardData.card_faces.find((face) => face.name.toLowerCase().includes(faceName.toLowerCase()))
    if (!face) {
        console.warn(`Couldn't find card face with name: '${faceName}'. Showing front face`)
        image_uris = cardData.card_faces[0].image_uris
    } else {
        console.log(`Found card face with name '${face.name}'`)
        image_uris = face.image_uris
    }

    if (!image_uris) {
        console.error(`Face of '${cardData.name}' doesn't have an image associated with it`)
        return
    }

    return selectImageUri(image_uris)
}

function selectImageUri(image_uris) {
    return image_uris.normal || image_uris.large || image_uris.small
}

function uploadImageToGroupMe(uri, callback) {
    HTTPS.get(uri, (response) => {
        var data = new Stream();
        response.on("data", (chunk) => data.push(chunk))
        response.on("end", () => postImage(data, callback))
    })
}

function postImage(data, callback) {
    const options = {
        hostname: "image.groupme.com",
        port: 443,
        path: "/pictures",
        method: "POST",
        headers: {
            "Content-Type": "application/jpeg",
            "X-Access-Token": accessToken
        }
    }

    const req = HTTPS.request(options, res => {
        let groupMeData = ""
        res.on("data", data => groupMeData += data)

        res.on("end", () => callback(JSON.parse(groupMeData)))
    })

    req.on("error", error => console.error(error))

    req.write(data.read())
    req.end()
}

function postMessage(content) {
    let options = {
        hostname: "api.groupme.com",
        path: "/v3/bots/post",
        method: "POST"
    }

    let body = {
        bot_id: botID,
        ...content
    }

    let request = HTTPS.request(options, function (res) {
        let resData = ""
        if (res.statusCode > 202) {
            console.log("rejecting bad status code " + res.statusCode);
        }

        res.on("data", (data) => resData += data)
        res.on("end", () => console.log(resData))
    })

    request.on("error", function (err) {
        console.error("Errored posting message: " + JSON.stringify(err));
    })
    request.on("timeout", function (err) {
        console.error("Timed out posting message: " + JSON.stringify(err));
    })

    request.end(JSON.stringify(body));
}


exports.respond = respond;