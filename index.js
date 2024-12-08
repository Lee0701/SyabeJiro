
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const p = require('phn')
const {https} = require('follow-redirects')
const queue = require('block-queue')
const Discord = require('discord.js')
const Voice = require('@discordjs/voice')
const {speak} = require('./papago-tts.js')
const {convertHanjaReading} = require('./hanja-reading.js')
const {normalizeKanji} = require('./kanji-reading.js')

const intents = [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildVoiceStates,
]
const client = new Discord.Client({intents})

const token = process.env.BOT_TOKEN
const prefix = process.env.CMD_PREFIX || '2?'

const WORDBOOK_FILENAME = 'wordbook.json'
const CACHE_DIRNAME = 'cache'
const FILE_PREFIX = 'file?'
const FILE_FORCE_PREFIX = 'file?!'

const MENTION_REGEX = /\<(\@|\#)\!?\d{18}\>/g
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g
const CUSTOM_EMOJI_REGEX = /\<a?\:[^\:]+\:\d+\>/g
const REGEX_REPLACEMENTS = [
    [MENTION_REGEX, 'mention'],
    [URL_REGEX, 'URL'],
    [CUSTOM_EMOJI_REGEX, 'emoji']
]

let guilds = {}
let wordBook = {}

const getWordBook = (guild) => {
    if(!wordBook[guild]) wordBook[guild] = {}
    return wordBook[guild]
}

const replaceBook = (book, text, language) => {
    const fullText = book[`|${text}|/${language}`] || book[`|${text}|`]
    if(fullText) return fullText
    const length = Object.keys(book).reduce((a, c) => c.length > a.length ? c : a, '').length
    let result = ''
    for(let i = 0; i < text.length; ) {
        let found = false
        for(let j = length; j > 0; j--) {
            if(i + j > text.length) continue
            const word = text.slice(i, i + j)
            const match = book[`${word}/${language}`] || book[word] || null
            if(match) {
                result += match
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

const downloadFile = (url, force=false) => new Promise(async (resolve, reject) => {
    const fileName = path.join(CACHE_DIRNAME, encodeURIComponent(url))
    if(force || !fs.existsSync(fileName)) {
        const file = fs.createWriteStream(fileName)
        https.get(url, (res) => {
            res.pipe(file)
            file.on('finish', () => {
                resolve(fs.createReadStream(fileName))
            })
        })
    } else {
        resolve(fs.createReadStream(fileName))
    }
})

const readWordBook = () => wordBook = fs.existsSync(WORDBOOK_FILENAME) ? JSON.parse(fs.readFileSync(WORDBOOK_FILENAME).toString()) : wordBook
const writeWordBook = () => fs.writeFileSync(WORDBOOK_FILENAME, JSON.stringify(wordBook, null, 2))

const preprocess = (text) => REGEX_REPLACEMENTS.reduce((acc, [regex, replacement]) => acc.replace(regex, replacement), text)

const processFetchQueue = ({guild, text, speaker}, done) => {
    if(text.startsWith(FILE_PREFIX) || text.startsWith(FILE_FORCE_PREFIX)) {
        if(!fs.existsSync(CACHE_DIRNAME)) fs.mkdirSync(CACHE_DIRNAME)
        const force = text.startsWith(FILE_FORCE_PREFIX)
        const url = text.startsWith(FILE_FORCE_PREFIX)
                ? text.slice(FILE_FORCE_PREFIX.length)
                : text.slice(FILE_PREFIX.length)
        downloadFile(url, force).then((stream) => {
            guild.speakQueue.push({guild, url: stream, volume: 0.25})
            done()
        })
    } else {
        speak(text, speaker).then((url) => {
            guild.speakQueue.push({guild, url})
            done()
        }).catch((err) => {
            console.error(err)
            speak(text, speaker).then((url) => {
                guild.speakQueue.push({guild, url})
                done()
            }).catch((err) => {
                console.error(err)
                done()
            })
        })
    }
}

const processSpeakQueue = ({guild, url, volume}, done) => {
    if(!volume) volume = 1
    p({url, stream: true}).then((stream) => {
        const resource = Voice.createAudioResource(stream, {volume})
        guild.audioPlayer.play(resource)
        guild.audioPlayer.on(Voice.AudioPlayerStatus.Idle, () => done())
        guild.audioPlayer.on('error', () => done())
    })
}

const joinCommand = (args, msg) => {
    const member = msg.guild.members.resolve(msg.author)
    const voice = member.voice
    if(!voice || !voice.channel) return
    const connection = Voice.joinVoiceChannel({
        channelId: voice.channel.id,
        guildId: msg.channel.guild.id,
        adapterCreator: msg.channel.guild.voiceAdapterCreator,
    })
    const audioPlayer = Voice.createAudioPlayer()
    connection.subscribe(audioPlayer)
    guilds[msg.channel.guild.id] = {
        channel: msg.channel,
        audioPlayer,
        fetchQueue: queue(1, processFetchQueue),
        speakQueue: queue(1, processSpeakQueue)
    }
}

const leaveCommand = (args, msg) => {
    const member = msg.guild.members.resolve(msg.author)
    const voice = member.voice
    if(!voice || !voice.channel) return
    const connection = Voice.getVoiceConnection(msg.channel.guild.id)
    if(connection) connection.destroy()
    if(guilds[msg.channel.guild.id]) delete guilds[msg.channel.guild.id]
}

const stopCommand = (args, msg) => {
    const guild = guilds[msg.channel.guild.id]
    if(guild && guild.audioPlayer) {
        guild.audioPlayer.stop(true)
    }
}

const wordbookCommand = (args, msg, cmd, fullArgs) => {
    if(args.length < 1) return
    const subCommand = args.shift()
    fullArgs = fullArgs.slice(cmd.length + subCommand.length + 2)
    const book = getWordBook(msg.channel.guild.id)
    if(subCommand == 'add') {
        const reply = fullArgs.split('\n')
                .filter((line) => line.trim())
                .map((line) => line.trim().split('=>').map((token) => token.trim()))
                .map(([word, reading]) => {
                    book[word] = reading
                    return `${word} => ${reading}`
                })
                .join('\n')
        if(reply) msg.channel.send(reply)
        writeWordBook()
    } else if(subCommand == 'remove' || subCommand == 'delete' || subCommand == 'rm') {
        const reply = fullArgs.split('\n')
                .map((line) => line.trim())
                .map((word) => {
                    if(book[word]) delete book[word]
                    return `${word} => ${word}`
                })
                .join('\n')
        if(reply) msg.channel.send(reply)
        writeWordBook()
    } else if(subCommand == 'list' || subCommand == 'ls') {
        const reply = Object.entries(book).map(([word, reading]) => `${word} => ${reading}`).join('\n')
        if(reply) msg.channel.send(reply)
    }
}

const commands = {
    join: joinCommand,
    summon: joinCommand,
    s: joinCommand,
    leave: leaveCommand,
    bye: leaveCommand,
    b: leaveCommand,
    stop: stopCommand,
    damare: stopCommand,
    d: stopCommand,
    wordbook: wordbookCommand,
    wb: wordbookCommand,
}

client.once(Discord.Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}.`)
    readWordBook()
})

client.on(Discord.Events.MessageCreate, (msg) => {
    if(msg.author.bot) return
    if(!msg.content) return

    if(msg.content.startsWith(prefix)) {
        const fullArgs = msg.content.slice(prefix.length)
        const args = fullArgs.split(/\s+/)
        const cmd = args.shift()
        const command = commands[cmd]
        if(command) command(args, msg, cmd, fullArgs)
        return
    }

    const guild = guilds[msg.channel.guild.id]
    if(guild && guild.channel.id == msg.channel.id) {
        const book = getWordBook(msg.channel.guild.id)
        const content = preprocess(msg.content)
        const kanaCount = content.split('').filter((c) => c >= '\u3040' && c <= '\u309f' || c >= '\u30a0' && c <= '\u30ff' || c >= '\uff66' && c <= '\uff9d').length
        const hangulCount = content.split('').filter((c) => c >= '\uac00' && c <= '\ud7af').length
        const language = kanaCount > hangulCount ? 'ja' : 'ko'
        const speaker = language == 'ja' ? 'yuri' : 'kyuri'
        let text = book ? replaceBook(book, content, language) : content
        if(language == 'ko') text = convertHanjaReading(text)
        if(language == 'ja') text = normalizeKanji(text)
        guild.fetchQueue.push({guild, text, speaker})
    }
})

client.login(token)
