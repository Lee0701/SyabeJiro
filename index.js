
require('dotenv').config()
const Discord = require('discord.js')
const {speak} = require('./papago-tts.js')

const client = new Discord.Client()

const token = process.env.BOT_TOKEN
const prefix = '2?'

const guilds = {}
const wordBooks = {}

const getWordBook = (guild) => {
    if(!wordBooks[guild]) wordBooks[guild] = {}
    return wordBooks[guild]
}

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
        } else if(args[0] == 'remove' || args[0] == 'delete') {
            if(args.length < 2) return
            const word = args[1]
            if(book[word]) delete book[word]
            msg.channel.send(`${word} => ${word}`)
        } else if(args[0] == 'list') {
            const text = Object.entries(book).map(([word, reading]) => `${word} => ${reading}`).join('\n')
            msg.channel.send(text)
        }
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}.`)
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
        const text = msg.content
        const kanaCount = text.split('').filter((c) => c >= '\u3040' && c <= '\u309f' || c >= '\u30a0' && c <= '\u30ff').length
        const hangulCount = text.split('').filter((c) => c >= '\uac00' && c <= '\ud7af').length
        const speaker = kanaCount > hangulCount ? 'yuri' : 'kyuri'
        speak(text, speaker).then((url) => {
            guild.queue.push(url)
            if(guild.queue.length === 1) speakNext()
        })
    }

})

client.login(token)
