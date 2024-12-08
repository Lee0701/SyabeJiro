FROM node:23
WORKDIR /usr/src/app

RUN apt update
RUN apt install -y ffmpeg

RUN npm install -g pnpm
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install

COPY . .

CMD ["pnpm", "start"]