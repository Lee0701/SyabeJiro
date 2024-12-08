
const p = require('phn')

const crypto = require('crypto')
const {v4: uuidv4} = require('uuid')

let uuid = null
let key = ''

const updateKey = () => {
  key = process.env.PAPAGO_VERSION || 'v1.5.5_69bb9312e1'
  uuid = uuidv4()
}

const generateAuthorization = (baseUrl) => {
  const timestamp = new Date().getTime()
  const hmac = crypto.createHmac('md5', key)
  hmac.update(`${uuid}\n${baseUrl}\n${timestamp}`)
  const token = hmac.digest('base64')
  const authorization = `PPG ${uuid}:${token}`
  return {timestamp, authorization}
}

const makeID = (text, speaker) => new Promise((resolve, reject) => {
  const baseUrl = 'https://papago.naver.com/apis/tts/makeID'
  const generateOptions = () => {
    const {timestamp, authorization} = generateAuthorization(baseUrl)
    return {
      url: baseUrl,
      method: 'POST',
      timeout: 1000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Authorization': authorization,
        'Timestamp': timestamp,
      },
      form: {
        alpha: '0',
        pitch: '0',
        speaker: speaker,
        speed: '0',
        text: text,
      },
    }
  }
  p(generateOptions()).then((res) => {
    if(res.statusCode === 403) {
      updateKey()
      p(generateOptions()).then(r => JSON.parse(r.body.toString()).id).catch(reject)
    } else {
      resolve(JSON.parse(res.body.toString()).id)
    }
  }).catch(reject)
})

const speak = (text, speaker) => new Promise((resolve, reject) => {
  makeID(text, speaker).then((id) => resolve(`https://papago.naver.com/apis/tts/${id}`)).catch(reject)
})

updateKey()

module.exports = {makeID, speak}
