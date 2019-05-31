FROM keymetrics/pm2:latest-alpine

# Bundle APP files
COPY config config/
COPY plugins plugins/
COPY routes routes/
COPY server.js .
COPY package.json .
COPY ecosystem.config.js .

# Install app dependencies
ENV NPM_CONFIG_LOGLEVEL warn
RUN npm install --development

# Expose the listening port of your app
EXPOSE 8090

# Show current folder structure in logs
RUN ls -al -R

CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]