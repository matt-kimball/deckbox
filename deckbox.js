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

/*global window, document, XMLHttpRequest, setTimeout, console*/
/*jshint -W097*/


'use strict';


/*
    A description of all cards, including their name, cost and rarity
    and path to an image, is loaded from here.  The attribute
    'data-deckbox-library' can be used to override this path.
*/
var deckboxLibraryPath = "https://eternal.deckbox.info/library.json";

/*  The currently hovered card, following the mouse cursor  */
var deckboxCardImage = null;


/*
    Construct an object tracking a set of influence requirements

    This object tracks the power requirement, as well as the faction
    influence required.
*/
function deckboxMakeInfluence(
    influenceString
) {
    var i,
        chr,
        digit,
        influence = {
            power: 0,
            fire: 0,
            justice: 0,
            primal: 0,
            shadow: 0,
            time: 0
        };

    /*
        Decode the input string representing influence.

        For example, '2FF' would represent two power, and
        two fire influence.
    */
    for (i = 0; i < influenceString.length; i += 1) {
        chr = influenceString[i];

        if (chr.charCodeAt(0) >= '0'.charCodeAt(0) &&
                chr.charCodeAt(0) <= '9'.charCodeAt(0)) {

            digit = Number(chr);
            if (influence.power > 0) {
                influence.power = influence.power * 10 + digit;
            } else {
                influence.power = digit;
            }
        } else if (chr === 'F') {
            influence.fire += 1;
        } else if (chr === 'J') {
            influence.justice += 1;
        } else if (chr === 'P') {
            influence.primal += 1;
        } else if (chr === 'S') {
            influence.shadow += 1;
        } else if (chr === 'T') {
            influence.time += 1;
        } else if (chr === 'X') {
            influence.wild += 1;
        } else {
            influence.makeError =
                'Invalid influence: "' + influenceString + '"';
        }
    }

    /*
        Compare to another influence object for sort ordering.
        Returns -1 if influence is first in sort order, 1 if
        other is first, and 0 if they are equal for sorting purposes.
    */
    influence.compare = function (other) {
        if (influence.power !== other.power) {
            return influence.power - other.power;
        }

        if (influence.shadow !== other.shadow) {
            return influence.shadow - other.shadow;
        }

        if (influence.primal !== other.primal) {
            return influence.primal - other.primal;
        }

        if (influence.justice !== other.justice) {
            return influence.justice - other.justice;
        }

        if (influence.time !== other.time) {
            return influence.time - other.time;
        }

        if (influence.fire !== other.fire) {
            return influence.fire - other.fire;
        }

        return 0;
    };

    if (influence.makeError) {
        console.log(influence.makeError);
        return null;
    } else {
        return influence;
    }
}


/*
    Parse a list of cards, in Eternal export format.

    The returned object includes two lists of objects, one for
    the main deck, and one for the market.

    Each card object has a count, name and id, where id is a string
    of the format "SetXX #YYY".
*/
function deckboxParseDeck(
    decklist
) {
    var cardRegex, marketRegex, cardMatch, marketMatch, deck, card, inMarket;

    cardRegex = /^\s*([0-9]+) ([^\(]+) \((Set[0-9]+ #[0-9]+)\)\s*(.*)/;
    marketRegex = /^\s*-+MARKET-+\s*(.*)/;

    deck = {
        mainDeck: [],
        market: []
    };
    inMarket = false;

    do {
        cardMatch = decklist.match(cardRegex);
        marketMatch = decklist.match(marketRegex);

        if (cardMatch) {
            card = {
                count: cardMatch[1],
                name: cardMatch[2],
                id: cardMatch[3]
            };
            decklist = cardMatch[4];

            if (inMarket) {
                deck.market.push(card);
            } else {
                deck.mainDeck.push(card);
            }
        } else if (marketMatch) {
            inMarket = true;
            decklist = marketMatch[1];
        }
    } while (cardMatch || marketMatch);

    return deck;
}


/*  Convenience for adding a new DOM element  */
function deckboxCreateAppendElement(
    parent,
    element,
    className
) {
    var child;

    child = document.createElement(element);
    child.setAttribute("class", className);
    parent.appendChild(child);

    return child;
}


/*  Convenience for adding text to a DOM element  */
function deckboxCreateAppendText(
    parent,
    text
) {
    var child;

    child = document.createTextNode(text);
    parent.appendChild(child);

    return child;
}


/*
    Show a popup of a card, which follows the mouse cursor.

    This is called when the mouse cursor is hovering over a card
    in the decklist.
*/
function deckboxShowCard(
    src
) {
    var img;

    deckboxCardImage =
        deckboxCreateAppendElement(document.body, "img", "deckbox-card-image");
    deckboxCardImage.setAttribute("src", src);
}


/*  Hide the current card popup  */
function deckboxHideCard() {
    if (deckboxCardImage) {
        document.body.removeChild(deckboxCardImage);
        deckboxCardImage = null;
    }
}


/*
    Reposition of the popup card relative to the given mouse
    cursor poisition.
*/
function deckboxPositionCard(
    x,
    y
) {
    if (deckboxCardImage) {
        x += 10;
        y -= 60;

        deckboxCardImage.style.left = x + "px";
        deckboxCardImage.style.top = y + "px";
    }
}


/*  Generate the DOM tree elements for displaying a decklist  */
function deckboxGenerate(
    deckboxDiv
) {
    /*  Add a column of cards  */
    function appendColumn(
        div
    ) {
        return deckboxCreateAppendElement(div, "div", "deckbox-column");
    }


    /*  Add a per-section header  */
    function appendSectionHeader(
        div,
        text
    ) {
        var header, textNode;

        deckboxCreateAppendElement(div, "div", "deckbox-section-header-space");
        header = deckboxCreateAppendElement(div, "div", "deckbox-section-header");
        deckboxCreateAppendText(header, text);
        deckboxCreateAppendElement(div, "div", "deckbox-section-header-space");

        return header;
    }


    /*  Generate the cost display, using CSS images for each influence  */
    function generateCost(
        div,
        cost
    ) {
        var influence, i, powerSpan;

        influence = deckboxMakeInfluence(cost);
        if (!influence) {
            return;
        }

        if (influence.power > 0) {
            powerSpan = deckboxCreateAppendElement(div, "span", "deckbox-cost-power");
            deckboxCreateAppendText(powerSpan, String(influence.power));
        }
        for (i = 0; i < influence.fire; i += 1) {
            deckboxCreateAppendElement(div, "span", "deckbox-fire-icon");
        }
        for (i = 0; i < influence.time; i += 1) {
            deckboxCreateAppendElement(div, "span", "deckbox-time-icon");
        }
        for (i = 0; i < influence.justice; i += 1) {
            deckboxCreateAppendElement(div, "span", "deckbox-justice-icon");
        }
        for (i = 0; i < influence.primal; i += 1) {
            deckboxCreateAppendElement(div, "span", "deckbox-primal-icon");
        }
        for (i = 0; i < influence.shadow; i += 1) {
            deckboxCreateAppendElement(div, "span", "deckbox-shadow-icon");
        }
    }


    /*  Generate a line corresponding to one card  */
    function appendCard(
        div,
        count,
        name,
        cardInfo
    ) {
        var line, field, link, text, rarityClass;

        line = deckboxCreateAppendElement(div, "div", "deckbox-card-line");
        field = deckboxCreateAppendElement(line, "span", "deckbox-card-count");
        deckboxCreateAppendText(field, count);

        rarityClass = "deckbox-card-rarity";
        if (cardInfo.rarity.length > 0) {
            rarityClass += " deckbox-card-rarity-" + cardInfo.rarity;
        }
        deckboxCreateAppendElement(line, "span", rarityClass);

        field = deckboxCreateAppendElement(line, "span", "deckbox-card-name");

        if (cardInfo) {
            link = deckboxCreateAppendElement(field, "a", "deckbox-card-link");
            link.setAttribute("href", cardInfo.link);

            link.addEventListener("mouseenter", function (event) {
                deckboxShowCard(cardInfo.image);
                deckboxPositionCard(event.x, event.y);
            });
            link.addEventListener("mouseleave", function (event) {
                deckboxHideCard();
            });

            deckboxCreateAppendText(link, name);
        } else {
            deckboxCreateAppendText(field, name);
        }

        field = deckboxCreateAppendElement(line, "div", "deckbox-card-cost");
        generateCost(field, cardInfo.cost);
    }


    /*
        Generate all DOM elements for a section, with the header and
        individual card lines.
    */
    function generateSection(
        column,
        library,
        sectionName,
        cards
    ) {
        var title, cardInfo, cardCount;

        if (cards.length === 0) {
            return;
        }

        /*  Sort cards by cost, then by influence factions  */
        cards.sort(function (a, b) {
            var infA, infB, powerDiff, infCompare;

            if (library[a.id]) {
                infA = deckboxMakeInfluence(library[a.id].cost);
            }
            if (library[b.id]) {
                infB = deckboxMakeInfluence(library[b.id].cost);
            }

            if (!infA && !infB) {
                return a.id.localeCompare(b.id);
            }
            if (!infA) {
                return -1;
            }
            if (!infB) {
                return 1;
            }

            infCompare = infA.compare(infB);
            if (infCompare) {
                return infCompare;
            }

            /*  If the cost is the same, use the card id for ordering  */
            return a.id.localeCompare(b.id);
        });

        cardCount = 0;
        cards.forEach(function (card) {
            cardCount += Number(card.count);
        });

        title = sectionName + " (" + String(cardCount) + ")";
        appendSectionHeader(column, title);
        cards.forEach(function (card) {
            cardInfo = library[card.id];
            appendCard(column, card.count, card.name, cardInfo);
        });
    }


    /*  Fade out the popup used as feedback when copying the decklist  */
    function animateFadeout(
        element
    ) {
        var opacity = 1.0;

        function dim() {
            opacity -= 0.05;

            if (opacity > 0) {
                element.style.opacity = opacity;

                setTimeout(dim, 33);
            } else {
                element.style.visibility = "hidden";
                element.style.opacity = 1.0;
            }
        }

        dim();
    }


    /*  Generate the deckbox header, with the deck title and copy button  */
    function generateHeader(
        div,
        copyDeckCallback
    ) {
        var title,
            href,
            header,
            link,
            titleDiv,
            copyButton,
            copyPopup;

        title = div.getAttribute("data-deckbox-title");
        href = div.getAttribute("data-deckbox-href");

        header = deckboxCreateAppendElement(div, "div", "deckbox-header");

        titleDiv = deckboxCreateAppendElement(header, "div", "deckbox-title");
        if (href && title) {
            link = deckboxCreateAppendElement(
                titleDiv, "a", "deckbox-title-link");
            link.setAttribute("href", href);
            deckboxCreateAppendText(link, title);
        } else if (title) {
            deckboxCreateAppendText(titleDiv, title);
        }

        copyButton =
            deckboxCreateAppendElement(header, "div", "deckbox-copy-button");
        deckboxCreateAppendText(copyButton, "Copy");
        copyPopup = deckboxCreateAppendElement(
            copyButton, "div", "deckbox-copy-popup");
        deckboxCreateAppendText(copyPopup, "Deck copied to clipboard");

        copyButton.addEventListener("click", function (event) {
            /*  Ignore spammed clicks to avoid visual weirdness  */
            if (copyPopup.style.visibility === "visible") {
                return;
            }

            /*  Copy to clipboard  */
            copyDeckCallback();

            /*  Show the popup as feedback  */
            copyPopup.style.visibility = "visible";
            setTimeout(function () {
                animateFadeout(copyPopup);
            }, 2000);
        });

        return header;
    }


    /*  Copy text to the clipboard  */
    function copyToClipboard(
        text
    ) {
        var textarea, scrollLeft, scrollTop;

        /*  Save and restore scroll position for IE  */
        scrollLeft = document.body.scrollLeft;
        scrollTop = document.body.scrollTop;

        textarea = deckboxCreateAppendElement(document.body, "textarea");

        textarea.value = text;
        textarea.select();
        document.execCommand("copy");

        document.body.removeChild(textarea);

        document.body.scrollLeft = scrollLeft;
        document.body.scrollTop = scrollTop;
    }


    /*
        Generate the deck text in a format suitable for import into
        Eternal, and copy it to the clipboard.
    */
    function exportDeck(
        deck
    ) {
        var decklist;

        decklist = "";

        deck.mainDeck.forEach(function (card) {
            decklist +=
                card.count + " " + card.name + " (" + card.id + ")\n";
        });
        if (deck.market.length > 0) {
            decklist += "--------------MARKET---------------\n";

            deck.market.forEach(function (card) {
                decklist +=
                    card.count + " " + card.name + " (" + card.id + ")\n";
            });
        }

        copyToClipboard(decklist);
    }


    /*
        Generate all the DOM elements for the deckbox, using an already
        parsed decklist and loaded card library.
    */
    function generateFromDecklist(
        deckboxDiv,
        deck,
        library
    ) {
        var column,
            cardInfo,
            section,
            sectionList,
            type,
            total,
            body,
            currentCount,
            currentColumn;

        section = {
            units: [],
            spells: [],
            attachments: [],
            other: [],
            power: [],
            market: []
        };

        /*  Categorize cards by type  */
        deck.mainDeck.forEach(function (card) {
            type = "other";
            cardInfo = library[card.id];
            if (cardInfo) {
                type = cardInfo.type;
            }

            if (type === "unit") {
                section.units.push(card);
            } else if (type === "spell") {
                section.spells.push(card);
            } else if (type === "attachment") {
                section.attachments.push(card);
            } else if (type === "power") {
                section.power.push(card);
            } else {
                section.other.push(card);
            }
        });

        deck.market.forEach(function(card) {
            section.market.push(card);
        });

        /*  Potentially generate a section for each category  */
        sectionList = [
            { name: "Units", cards: section.units },
            { name: "Spells", cards: section.spells },
            { name: "Attachments", cards: section.attachments },
            { name: "Other", cards: section.other },
            { name: "Power", cards: section.power },
            { name: "Market", cards: section.market }
        ];

        /*  Count all card entries for splitting into columns  */
        total = 0;
        sectionList.forEach(function (section) {
            total += section.cards.length;
        });

        generateHeader(deckboxDiv, function () {
            exportDeck(deck);
        });
        body = deckboxCreateAppendElement(deckboxDiv, "div", "deckbox-body");

        column = appendColumn(body);
        currentCount = 0;
        currentColumn = 0;
        sectionList.forEach(function (section) {
            /*   Start a new column halfway through the deck  */
            if (currentCount >= total / 2 && currentColumn === 0) {
                column = appendColumn(body);
                currentColumn += 1;
            }

            generateSection(column, library, section.name, section.cards);
            currentCount += section.cards.length;
        });
    }


    /*
        Load the card library, and generate the deckbox when loading
        has finished.
    */
    function loadLibrary() {
        var xhr, decklist, deck, library, libraryPath;

        decklist = deckboxDiv.innerText;
        deckboxDiv.innerText = "";

        deck = deckboxParseDeck(decklist);

        xhr = new XMLHttpRequest();
        xhr.addEventListener("load", function () {
            library = JSON.parse(xhr.responseText);
            generateFromDecklist(deckboxDiv, deck, library);
        });

        libraryPath = deckboxDiv.getAttribute("data-deckbox-library");
        if (!libraryPath) {
            libraryPath = deckboxLibraryPath;
        }

        xhr.open("GET", libraryPath);
        xhr.send();        
    }


    loadLibrary();
}


/*
    Generate deckboxes for all elements with class "deckbox"
    in the DOM.
*/
function deckboxGenerateAll() {
    var deckboxes, i;

    deckboxes = document.getElementsByClassName("deckbox");
    for (i = 0; i < deckboxes.length; i += 1) {
        deckboxGenerate(deckboxes[i]);
    }
}


/* 
    Automatically generate all decklists when the page load
    has completed.
*/
if (document.readyState === "loading") {
    document.addEventListener("readystatechange", function() {
        if (document.readyState === "interactive") {
            deckboxGenerateAll();
        }
    });
} else {
    deckboxGenerateAll();
}

/*  Card popups should track the mouse cursor  */
window.addEventListener("mousemove", function (event) {
    deckboxPositionCard(event.x, event.y);
});
