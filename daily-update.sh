#!/bin/sh
#
#    Eternal Deckbox Display
#    Copyright (C) 2018  Matt Kimball
#
#    This program is free software; you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation; either version 2 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License along
#    with this program; if not, write to the Free Software Foundation, Inc.,
#    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
#


#  Clone the github repo to get up to date
rm -fr /tmp/deckbox
git clone git@github.com:matt-kimball/deckbox.git /tmp/deckbox
if [ $? -ne 0 ]; then
    echo Git clone failure
    exit 1
fi

#  Install dependencies
cd /tmp/deckbox
npm install unescape@1.0.1
if [ $? -ne 0 ]; then
    echo npm install failure
    exit 1
fi

#  Gather the library by scraping shiftstoned / eternalwarcry
node gatherlib.js >library.json
if [ $? -ne 0 ]; then
    echo Gather failure
    exit 1
fi

#  If the library hasn't changed since the last update, we can stop here
git diff --exit-code library.json
if [ $? -eq 0 ]; then
    echo No change
    exit 0
fi

#  Commit the new library to github
git add library.json
git commit '--message=Automatic library.json update'
git push origin master
