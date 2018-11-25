/*

    Eternal Deckbox Display
    Copyright (C) 2018  Matt Kimball

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

*/

/*jshint esversion: 6*/


const https = require('https');
const unescape = require('unescape');


/*
    Retrieve a page over HTTPS, following redirects.
    Call onBody with the final URL and page contents on
    completion.  On error, report to stderr and exit.
*/
function getPage(host, location, onBody) {
    https.get({ hostname: host, path: location }, function (response) {
        if (response.statusCode === 301) {
            response.destroy();
            return getPage(host, response.headers.location, onBody);
        }

        if (response.statusCode !== 200) {
            process.stderr.write("HTTP error " + response.statusCode + "\n");
            process.exit(1);
        }

        body = '';
        response.on('data', function (data) {
            body += data.toString('utf-8');
        });
        response.on('end', function () {
            var url = 'https://' + host + location;

            onBody(url, body);
        });
    }).on('error', function (e) {
        process.stderr.write("HTTP error: " + e.message + "\n");
        process.exit(1);
    }).on('timeout', function (e) {
        process.stderr.write("timeout");
        process.exit(1);
    });
}


/*
    Given a card specified with set number and card number,
    get an image URL, card rarity and card type
    from eternalwarcry.com.

    Upon retrieval, onInfo is called with an object containing
    those attributes.
*/
function warcryInfo(set, card, onInfo) {
    var path;

    path = '/cards/details/' + String(set) + '-' + String(card) + '/';
    getPage('eternalwarcry.com', path, function (url, body) {
        var info, imageRegex, rarityRegex, typeRegex;
        var imageMatch, rarityMatch, typeMatch, image, rarity, typeText, type;

        imageRegex = /property="og:image" content="([^"]+)"/;
        imageMatch = body.match(imageRegex);
        if (imageMatch) {
            image = unescape(imageMatch[1]);
        } else {
            image = "";
        }

        rarityRegex = /class="rarity-icon rarity-([^"]+)"/;
        rarityMatch = body.match(rarityRegex);
        if (rarityMatch) {
            rarity = rarityMatch[1];
        } else {
            rarity = "";
        }

        typeRegex = /<a href="\/cards\?Types=[0-9]+">([^<]+)<\/a>/;
        typeMatch = body.match(typeRegex);
        type = "";
        if (typeMatch) {
            typeText = typeMatch[1];

            if (typeText === "Power") {
                type = "power";
            }

            if (typeText === "Unit") {
                type = "unit";
            }

            if (typeText === "Spell" || typeText === "Fast Spell") {
                type = "spell";
            }

            if (typeText === "Weapon" || typeText === "Relic Weapon" ||
                    typeText === "Relic" || typeText === "Curse" ||
                    typeText === "Cursed Relic") {

                type = "attachment";
            }
        }

        onInfo({
            link: url,
            image: image,
            rarity: rarity,
            type: type
        });
    });
}


/*
    Get a list of all cards by scraping the power caculator
    at https://www.shiftstoned.com/epc/

    The completed list is passed through a callback, containing
    card names, card numbers and costs.
*/
function shiftstonedCardList(onDone) {
    var cards = [];

    getPage('www.shiftstoned.com', '/epc/', function (url, body) {
        body.split('\n').forEach(function (line) {
            var cardRegex;

            cardRegex =
                /Set([0-9]+) #([0-9]+);([^;]*);([^;]*);([^;]*);([^;]*)/;
            cardMatch = line.match(cardRegex);
            if (cardMatch) {
                cards.push({
                    set: cardMatch[1],
                    number: cardMatch[2],
                    influence: cardMatch[3].trim(),
                    cost: cardMatch[4].trim(),
                    name: cardMatch[5].trim(),
                    flags: cardMatch[6].trim()
                });
            }
        });

        onDone(cards);
    });
}


/*
    Gather the library information for all cards, first by retrieving
    a cardlist from shiftstoned.com, and then getting card details
    from eteranlwarcry.com
*/
function gatherCards(onCards) {
    allCards = {};

    shiftstonedCardList(function (cardLibrary) {
        var index = 0;

        /*
            Generate information for the next card, using
            tail recursion to step through the cards
        */
        function nextCard() {
            var card;

            /*  Show progress  */
            process.stderr.write('.');

            if (index >= cardLibrary.length) {
                onCards(allCards);
                return;
            }

            card = cardLibrary[index];
            warcryInfo(card.set, card.number, function (info) {
                var id;

                id = "Set" + card.set + " #" + card.number;
                info.name = card.name;
                info.cost = card.cost;

                allCards[id] = info;

                index += 1;

                /*
                    Delay slightly between cards to avoid hammering
                    eternalwarcry.
                */
                setTimeout(nextCard, 100);
            });
        }

        nextCard();
    });
}


/*  Gather the card library, then dump the JSON to stdout  */
gatherCards(function (cards) {
    console.log(JSON.stringify(cards));
});
