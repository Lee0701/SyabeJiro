const {buildDict} = require('./dictionary')
const dic2 = buildDict('dic/dic2.txt')
const dic4 = buildDict('dic/dic4.txt')
const MAX_LENGTH = 10
const convertHanjaReading = (str) => {
    if(str.includes(' ')) return str.split(' ').map((word) => convertHanjaReading(word))
    if(str.length > MAX_LENGTH) return str.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g')).map((str) => convertHanjaReading(str))
    str = str.normalize('NFKC')
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
                result += value
                i += j - i
                found = true
            }
        }
        if(!found) {
            result += c
            i++
        }
    }
    return result
}
module.exports = {convertHanjaReading}