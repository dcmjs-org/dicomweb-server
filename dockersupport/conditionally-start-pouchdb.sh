#!/bin/bash

if [ $USE_POUCHDB = "true" ]
then
    echo "USE_POUCHDB is true, starting PouchDB service"
    /usr/src/app/node_modules/pouchdb-server/bin/pouchdb-server --in-memory --host 0.0.0.0
else
    exit 0
fi
