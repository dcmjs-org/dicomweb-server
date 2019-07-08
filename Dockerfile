# DOCKER-VERSION 1.0

# Base image for other SlicerDocker platform images
# (based on https://github.com/dit4c/dockerfile-dit4c-container-base)
FROM apache/couchdb:2.3.1
MAINTAINER pieper@isomics.com

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN apt-get install -y nodejs

RUN apt-get install -y git

# add dcmjs
RUN ( \
	git clone https://github.com/dcmjs-org/dcmjs; \
  ( cd dcmjs; \
    npm install .; \
    npm run build; \
  ) \
)

# add dicomweb-server and run it
RUN ( \
	git clone https://github.com/dcmjs-org/dicomweb-server; \
  ( cd dicomweb-server; \
    npm install .; \
  ) \
)

EXPOSE 5984/tcp
EXPOSE 5985/tcp

# set up the start script
COPY docker-start.sh /start.sh
RUN chmod a+x /start.sh
ENTRYPOINT ["tini", "--", "/start.sh"]
