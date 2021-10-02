const {buildDict} = require('./dictionary')
const dic = buildDict('dic/jp.txt', true)

const normalizeKanji = (str) => str.normalize('NFKC').split('').map((c) => dic[c] || c).join('')

module.exports = {normalizeKanji}