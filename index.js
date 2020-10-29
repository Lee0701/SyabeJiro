
require('dotenv').config()
const fs = require('fs')
const Discord = require('discord.js')
const {speak} = require('./papago-tts.js')

const client = new Discord.Client()

const token = process.env.BOT_TOKEN
const prefix = '2?'

const MENTION_REGEX = /\<(\@\!|\#)\d{18}\>/g
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g
const REGEX_REPLACEMENTS = [
    [MENTION_REGEX, ''],
    [URL_REGEX, ''],
]

let guilds = {}
let wordBook = {}

const getWordBook = (guild) => {
    if(!wordBook[guild]) wordBook[guild] = {}
    return wordBook[guild]
}

const replaceBook = (book, text) => {
    const length = Object.keys(book).reduce((a, c) => c.length > a.length ? c : a).length
    let result = ''
    for(let i = 0; i < text.length; ) {
        let found = false
        for(let j = length; j > 0; j--) {
            if(i + j > text.length) continue
            const word = text.slice(i, i + j)
            if(book[word]) {
                result += book[word]
                i += word.length
                found = true
            }
        }
        if(!found) {
            result += text.charAt(i)
            i += 1
        }
    }
    return result
}

const readWordBook = () => wordBook = fs.existsSync('wordbook.json') ? JSON.parse(fs.readFileSync('wordbook.json').toString()) : wordBook
const writeWordBook = () => fs.writeFileSync('wordbook.json', JSON.stringify(wordBook, null, 2))

const preprocess = (text) => REGEX_REPLACEMENTS.reduce((acc, [regex, replacement]) => acc.replace(regex, replacement), text)

const commands = {
    join: (args, msg) => {
        const member = msg.guild.members.resolve(msg.author)
        const voice = member.voice
        if(!voice || !voice.channel) return
        voice.channel.join().then((connection) => {
            guilds[msg.channel.guild.id] = {
                channel: msg.channel,
                connection: connection,
                queue: []
            }
        })
    },
    leave: (args, msg) => {
        const member = msg.guild.members.resolve(msg.author)
        const voice = member.voice
        if(!voice || !voice.channel) return
        voice.channel.leave()
        if(guilds[msg.channel.guild.id]) delete guilds[msg.channel.guild.id]
    },
    wordbook: (args, msg) => {
        if(args.length < 1) return
        const book = getWordBook(msg.channel.guild.id)
        if(args[0] == 'add') {
            if(args.length < 3) return
            const word = args[1]
            const reading = args[2]
            book[word] = reading
            msg.channel.send(`${word} => ${reading}`)
            writeWordBook()
        } else if(args[0] == 'remove' || args[0] == 'delete') {
            if(args.length < 2) return
            const word = args[1]
            if(book[word]) delete book[word]
            msg.channel.send(`${word} => ${word}`)
            writeWordBook()
        } else if(args[0] == 'list') {
            const text = Object.entries(book).map(([word, reading]) => `${word} => ${reading}`).join('\n')
            msg.channel.send(text)
        }
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}.`)
    readWordBook()
})

client.on('message', (msg) => {
    if(msg.author.bot) return
    if(!msg.content) return

    if(msg.content.startsWith(prefix)) {
        const args = msg.content.slice(prefix.length).split(/\s+/)
        const cmd = args.shift()
        const command = commands[cmd]
        if(command) command(args, msg)
        return
    }

    const guild = guilds[msg.channel.guild.id]
    if(guild && guild.channel.id == msg.channel.id) {
        const speakAuto = (url) => new Promise((resolve, reject) => {
            const dispatcher = guild.connection.play(url)
            dispatcher.on('finish', () => {
                resolve()
            })
        })
        const speakNext = () => {
            speakAuto(guild.queue[0]).then(() => {
                guild.queue.shift()
                if(guild.queue.length > 0) speakNext()
            }).catch(() => {
                if(guild.queue.length > 0) speakNext()
            })
        }
        const book = getWordBook(msg.channel.guild.id)
        const content = preprocess(msg.content)
        const text = book ? replaceBook(book, content) : content
        const kanaCount = text.split('').filter((c) => c >= '\u3040' && c <= '\u309f' || c >= '\u30a0' && c <= '\u30ff' || c >= '\uff66' && c <= '\uff9d').length
        const hangulCount = text.split('').filter((c) => c >= '\uac00' && c <= '\ud7af').length
        const speaker = kanaCount > hangulCount ? 'yuri' : 'kyuri'
        speak(text, speaker).then((url) => {
            guild.queue.push(url)
            if(guild.queue.length === 1) speakNext()
        })
    }

})

client.login(token)
