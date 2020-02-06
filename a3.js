const fs = require('fs')
const path = require('path')
const HTML_FILES_DIR_NAME = 'Files'
const HTML_FILES_LOCATION = path.join(__dirname, HTML_FILES_DIR_NAME)
const ERR_EEXIST = 'EEXIST'

const STUDENT_ID = 2728814

try {
    fs.mkdirSync(path.join(__dirname, 'output'))
} catch (err) {
    if (err.code !== ERR_EEXIST) throw err
}

/**
 * 
 * @param {string} data 
 */
const removeHTMLTags = async (data) => {
    const tagRegexp = /<((?=!\-\-)!\-\-[\s\S]*\-\-|((?=\?)\?[\s\S]*\?|((?=\/)\/[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*|[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:\s[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:=(?:"[^"]*"|'[^']*'|[^'"<\s]*))?)*)\s?\/?))>/ig
    return data.replace(tagRegexp, '')
}

/**
 * 
 * @param {Promise} taskP 
 */
const measureTime = async taskP => {
    const t_begin = (new Date()).getTime()
    const result = await taskP
    const t_end = (new Date()).getTime()
    return {
        time: t_end - t_begin,
        result
    }
}

const listWords = async text => {
    const wordRegexp = /\w+/g
    const match = text.match(wordRegexp)
    if (match) {
        return [...match].sort((a, b) => {
            const A = a.toUpperCase()
            const B = b.toUpperCase()
            if (A < B) return -1
            if (A > B) return 1
            return 0
        })
    } else {
        return []
    }
}

const a3 = async (filesLocation, outputFilesLocation, outputStream) => {
    let t_operation_total = 0
    const a3_main = async () => {
        try {
            await fs.promises.mkdir(outputFilesLocation)
        } catch (err) {
            if (err.code !== ERR_EEXIST) {
                throw err
            }
        }

        const fileList = await fs.promises.readdir(filesLocation)
        for (let i = 0; i < fileList.length; i++) {
            const fileName = fileList[i]
            const file = await fs.promises.readFile(path.join(filesLocation, fileName))
            const file_noHTML = await removeHTMLTags(file.toString())
            const timedResult = await measureTime(
                listWords(file_noHTML).then(async wordList => {
                    await fs.promises.writeFile(
                        path.join(outputFilesLocation, fileName + ".txt"),
                        wordList.join('\n')
                    )
                })
            )
            const log = `${fileName}\t${timedResult.time / 1000} s.\n`
            outputStream.write(log)
            t_operation_total += timedResult.time
        }
    }
    const timedResult = await measureTime(
        a3_main()
    )
    outputStream.write(
        `Total operation time:\t${t_operation_total / 1000} s.\n` +
        `Total execution time:\t${timedResult.time / 1000} s.\n`
    )
    outputStream.close()
}

a3(
    HTML_FILES_LOCATION,
    path.join(__dirname, 'output', `a3`),
    fs.createWriteStream(path.join(__dirname, 'output', `a3_${STUDENT_ID}.txt`))
)