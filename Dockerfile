# docker build -t ohif/dicomweb-server:latest .
# docker run -p 5985:5985 ohif/dicomweb-server:latest
# If you want to use PouchDB in this container, add -p 5984:5984
# docker run -p 5985:5985 -p 5984:5984 -e USE_POUCHDB=true ohif/dicomweb-server:latest
FROM node:13.10.1-slim

# Install prerequisites
RUN apt-get update
RUN apt-get -y install git-core \
	supervisor

# Grab Source
RUN mkdir /usr/src/app
WORKDIR /usr/src/app
ADD . /usr/src/app

# Restore deps
RUN npm ci
RUN npm install pouchdb-server

# Override config
COPY ./dockersupport/server-config.js config/development.js

# Copy the scripts to run dicomweb-server and PouchDB
COPY ./dockersupport/dicomweb-server-service.sh /usr/src/dicomweb-server-service.sh
RUN chmod 777 /usr/src/dicomweb-server-service.sh

COPY ./dockersupport/conditionally-start-pouchdb.sh /usr/src/conditionally-start-pouchdb.sh
RUN chmod 777 /usr/src/conditionally-start-pouchdb.sh

ENV USE_POUCHDB=false

# Setup Supervisord
COPY ./dockersupport/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 5984 5985
CMD ["supervisord", "-n"]
