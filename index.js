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
 * Measures the time taken to complete a Promise in nanoseconds
 * @param {Promise} nano A Promise to measure
 * @returns
 */
const measureTime_nano = async taskP => {
    const t_begin = process.hrtime.bigint()
    const result = await taskP
    const t_end = process.hrtime.bigint()
    return {
        time: t_end - t_begin,
        result
    }
}

/**
 * Lists the words of a given text
 * @param {string} text 
 * @returns {Promise<string[]>}
 */
const listWords = async text => {
    const wordRegexp = /\w+/g
    const match = text.match(wordRegexp)
    if (match) {
        return [...match]
    } else {
        return []
    }
}

/**
 * Returns the alphabetic order by comparing two strings
 * @param {string} a 
 * @param {string} b 
 * @returns {number} order
 */
const sortOrder_alphabetic = (a, b) => {
    const A = a.toUpperCase()
    const B = b.toUpperCase()
    if (A < B) return -1
    if (A > B) return 1
    return 0
}

/**
 * Returns the numeric order by comparing two numbers, ascending
 * @param {number} a 
 * @param {number} b 
 */
const sortOrder_numeric_asc = (a, b) => a - b

/**
 * Returns the numeric order by comparing two numbers, descending
 * @param {number} a 
 * @param {number} b 
 */
const sortOrder_numeric_desc = (a, b) => b - a

/**
 * Generates and dumps the tokens into the dictionary
 * @param {{[token:string]: {times: number}}} dictionary Where the tokens will be dumped
 * @param {string[]} words Words used to generate the tokens
 * @returns {Promise<void>}
 */
const dumpTokensToDictionary = async (dictionary, words) => {
    words.forEach(word => {
        const match = dictionary[word]
        if (match) {
            dictionary[word].times++
        } else {
            dictionary[word] = { times: 1 }
        }
    })
}

/**
 * 
 * @param {string} documentsDir location of the HTML documents
 * @param {string} outputDir location for the generated files
 * @param {*} outputStream the write stream for the log file
 */
const main = async (documentsDir, outputDir, outputStream) => {
    let t_operation_total_ns = 0n // This will be the sum for the time taken to generate each file
    const global_dictionary = {} // All the tokens from all the files
    const global_dictionary_operations = []

    const main_sub = async () => {
        try {
            await fs.promises.mkdir(outputDir)
        } catch (err) {
            if (err.code !== ERR_EEXIST) {
                throw err
            }
        }

        const fileList = await fs.promises.readdir(documentsDir)
        for (let i = 0; i < fileList.length; i++) {
            const fileName = fileList[i]
            const operation = async () => {
                const file = await fs.promises.readFile(path.join(documentsDir, fileName))
                const file_noHTML = await removeHTMLTags(file.toString())
                let words = await listWords(file_noHTML)
                words = words.map(word => word.toLowerCase()) // Set the words to lowercase
                const dictionary = {}
                await dumpTokensToDictionary(dictionary, words)
                global_dictionary_operations.push(
                    dumpTokensToDictionary(global_dictionary, words) // Do not wait for this
                )
                const dictionaryFile = Object.keys(dictionary)
                    .sort(sortOrder_alphabetic)
                    .map(token => `${token}\t${dictionary[token].times}`)
                    .join('\n')
                await fs.promises.writeFile(
                    path.join(outputDir, `${fileName}.txt`),
                    dictionaryFile
                )
            }
            const timedResult = await measureTime_nano(operation())
            const log = `${fileName}\t${Number(timedResult.time) / 1000000000} s.\n`
            outputStream.write(log)
            t_operation_total_ns += timedResult.time
        }
        await Promise.all(global_dictionary_operations) // Wait for any dumping to the global dictionary
        const dictionaryFile_g = Object.keys(global_dictionary)
            .sort((tokenA, tokenB) => sortOrder_numeric_desc(
                global_dictionary[tokenA].times,
                global_dictionary[tokenB].times
            ))
            .map(token => `${token}\t${global_dictionary[token].times}`)
            .join('\n')

        await fs.promises.writeFile(
            path.join(outputDir, "_tokens.txt"),
            dictionaryFile_g
        )
    }
    const timedResult = await measureTime(
        main_sub()
    )
    outputStream.write(
        `Total operation time:\t${Number(t_operation_total_ns) / 1000000000} s.\n` +
        `Total execution time:\t${timedResult.time / 1000} s.\n`
    )
    outputStream.close()
}

main(
    HTML_FILES_LOCATION,
    path.join(__dirname, 'output', `a5`),
    fs.createWriteStream(path.join(__dirname, 'output', `a5_${STUDENT_ID}.txt`))
)