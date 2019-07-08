#!/bin/bash

/opt/couchdb/bin/couchdb &
timeout 300 bash -c 'while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' localhost:5984)" != "200" ]]; do sleep 1; done' || false
curl -X PUT http://127.0.0.1:5984/_users
curl -X PUT http://127.0.0.1:5984/_replicator
node dicomweb-server/server.js
