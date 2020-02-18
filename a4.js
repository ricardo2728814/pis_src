const fs = require('fs')
const path = require('path')
const HTML_FILES_DIR_NAME = 'Files'
const HTML_FILES_LOCATION = path.join(__dirname, HTML_FILES_DIR_NAME)
const ERR_EEXIST = 'EEXIST'
const MSG_ERR_FOLDER_CREATION = folder => `Failed to make directory ${folder}.`
const OUTPUT_FOLDER = path.join(__dirname, 'output')
const STUDENT_ID = 2728814

/**
 * Create a folder for the output
 */
try {
    fs.mkdirSync(OUTPUT_FOLDER)
} catch (err) {
    if (err.code !== ERR_EEXIST) {
        console.log(MSG_ERR_FOLDER_CREATION(OUTPUT_FOLDER))
        throw err
    }
}

/**
 * Removes HTML tags
 * @param {string} data 
 * @returns {Promise<string>}
 */
const removeHTMLTags = async (data) => {
    const tagRegexp = /<((?=!\-\-)!\-\-[\s\S]*\-\-|((?=\?)\?[\s\S]*\?|((?=\/)\/[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*|[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:\s[^.\-\d][^\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:=(?:"[^"]*"|'[^']*'|[^'"<\s]*))?)*)\s?\/?))>/ig
    return data.replace(tagRegexp, '')
}

/**
 * Measures the time taken to complete a Promise
 * @param {Promise} taskP A Promise to measure
 * @returns
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

/**
 * Lists words alphabetically
 * @param {string} text
 * @returns {Promise<string[]>}
 */
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

/**
 * 
 * @param {string} filesLocation location of the HTML documents
 * @param {string} outputFilesLocation location for the generated files
 * @param {*} outputStream the write stream for the log file
 */
const a4 = async (filesLocation, outputFilesLocation, outputStream) => {
    let t_operation_total = 0 // This will be the sum for the time taken to generate each file
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
                        wordList.join('\n').toLowerCase() // The whole document is set to lowecase
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

a4(
    HTML_FILES_LOCATION,
    path.join(__dirname, 'output', `a4`),
    fs.createWriteStream(path.join(__dirname, 'output', `a4_${STUDENT_ID}.txt`))
)