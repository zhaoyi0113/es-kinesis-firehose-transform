FROM node:14

WORKDIR /usr/src

COPY . .

RUN yarn install --frozen-lockfile

EXPOSE 8080

CMD [ "node", "index.js" ]
