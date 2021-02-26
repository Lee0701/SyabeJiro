const fs = require('fs')
const buildDict = (file) => fs.readFileSync(file)
        .toString()
        .split('\n')
        .filter((line) => !line.startsWith('#') && line.trim() != '')
        .map((line) => line.split('\t').map((item) => item.trim()))
        .reduce((acc, [key, value]) => (acc[key] = value, acc), {})
module.exports = {buildDict}