FROM node:12
WORKDIR /usr/src/app

RUN apt update
RUN apt install -y ffmpeg

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]