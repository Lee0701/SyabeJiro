const {buildDict} = require('./dictionary')
const dic2 = buildDict('dic/dic2.txt')
const dic4 = buildDict('dic/dic4.txt')
const jp = buildDict('dic/jp.txt')
const cn = buildDict('dic/cn.txt')
const MAX_LENGTH = 10
const convertHanjaReading = (str, initial=true) => {
    if(str.includes(' ')) return str.split(' ').map((word) => convertHanjaReading(word, true)).join(' ')
    if(str.length > MAX_LENGTH) return str.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g')).map((str, i) => convertHanjaReading(str, initial && i == 0)).join('')
    if(str.length == 0) return str
    str = normalizeHanja(str)
    let result = ''
    for(let i = 0; i < str.length; ) {
        let found = false
        const c = str.charAt(i)
        if(c >= '가' && c <= '힣') {
            result += c
            i++
            continue
        }
        for(let j = str.length; j > i; j--) {
            const key = str.slice(i, j)
            const value = dic4[key] || dic2[key]
            if(value) {
                result += initial ? initialSoundLaw(value) : value
                i += j - i
                found = true
            }
        }
        if(!found) {
            result += c
            i++
        }
        initial = false
    }
    return result
}
const normalizeHanja = (str) => str.normalize('NFKC').split('').map((c) => dic2[c] ? c : jp[c] || cn[c] || c).join('')
const initialSoundLaw = (str) => {
    const c = str.charAt(0).normalize('NFD').split('')
    if(c[0] == 'ᄅ') c[0] = 'ᄂ'
    if(c[0] == 'ᄂ' && 'ᅣᅤᅧᅨᅭᅲᅴᅵ'.includes(c[1])) c[0] = 'ᄋ'
    return c.join('').normalize('NFC') + str.slice(1)
}
module.exports = {convertHanjaReading, initialSoundLaw}