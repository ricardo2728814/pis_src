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

const a2 = async (filesLocation, outputFilesLocation, outputStream) => {
    let t_operation_total = 0
    const a2_main = async () => {
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
            const timedResult = await measureTime(
                removeHTMLTags(file.toString()).then(
                    stripped => fs.promises.writeFile(
                        path.join(outputFilesLocation, fileName),
                        stripped
                    )
                )
            )
            const log = `${fileName}\t${timedResult.time / 1000} s.\n`
            outputStream.write(log)
            t_operation_total += timedResult.time
        }
    }
    const timedResult = await measureTime(
        a2_main()
    )
    outputStream.write(
        `Total operation time:\t${t_operation_total/1000} s.\n` +
        `Total execution time:\t${timedResult.time/1000} s.\n`
    )
    outputStream.close()
}

a2(
    HTML_FILES_LOCATION,
    path.join(__dirname, 'output', `a2`),
    fs.createWriteStream(path.join(__dirname, 'output', `a2_${STUDENT_ID}.txt`))
)