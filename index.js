
require('dotenv').config()
const Discord = require('discord.js')
const {speak} = require('./papago-tts.js')

const client = new Discord.Client()

const token = process.env.BOT_TOKEN
const prefix = '2?'

const channels = {}

const commands = {
    join: (args, msg) => {
        const member = msg.guild.members.resolve(msg.author)
        const voice = member.voice
        if(!voice || !voice.channel) return
        voice.channel.join().then((connection) => {
            channels[msg.channel.id] = {
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
        if(channels[msg.channel.id]) delete channels[msg.channel.id]
    },
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}.`)
})

client.on('message', (msg) => {
    if(msg.author.bot) return
    if(!msg.content) return

    const channel = channels[msg.channel.id]
    if(channel) {
        channel.queue.push(msg.content)
        const speakAuto = (text) => new Promise((resolve, reject) => {
            const kanaCount = text.split('').filter((c) => c >= '\u3040' && c <= '\u309f' || c >= '\u30a0' && c <= '\u30ff').length
            const hangulCount = text.split('').filter((c) => c >= '\uac00' && c <= '\ud7af').length
            const speaker = kanaCount > hangulCount ? 'yuri' : 'kyuri'
            speak(text, speaker).then((url) => {
                const dispatcher = channel.connection.play(url)
                dispatcher.on('finish', () => {
                    resolve()
                })
            })
        })
        const speakNext = () => {
            speakAuto(channel.queue[0]).then(() => {
                channel.queue.shift()
                if(channel.queue.length > 0) speakNext()
            })
        }
        if(channel.queue.length === 1) speakNext()
    }

    if(msg.content.startsWith(prefix)) {
        const args = msg.content.slice(prefix.length).split(/\s+/)
        const cmd = args.shift()
        const command = commands[cmd]
        if(command) command(args, msg)
    }
})

client.login(token)
