# docker build -t ohif/dicomweb-server:latest .
# docker run -p 5985:5985 ohif/dicomweb-server:latest
# If you want to use PouchDB in this container, add -p 5984:5984
# docker run -p 5985:5985 -p 5984:5984 -e USE_POUCHDB=true -e DB_SERVER=http://0.0.0.0 ohif/dicomweb-server:latest
FROM node:13.10.1-slim

# Install prerequisites
RUN apt-get update
RUN apt-get -y install supervisor

USER node
RUN mkdir -p /home/node/app
RUN mkdir -p /home/node/log/supervisor
WORKDIR /home/node/app
ADD . /home/node/app

# Restore deps
RUN npm ci
RUN npm install pouchdb-server@4.2.0

ENV USE_POUCHDB=false

EXPOSE 5984 5985
CMD ["supervisord", "-n", "-c", "/home/node/app/dockersupport/supervisord.conf"]
