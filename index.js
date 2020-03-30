// @ts-check
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
    const htmlCommentRegexp = /<!--(.*?)-->/igm
    const tagRegexp = /<\/*\s*[\w\-]+(\s*[\w\-]+\s*=\s*("([^"]*)"|[\w\n%\-\#\/\.\+,]+|'([^']*)'))*\s*\/*>/igm
    return data.replace(htmlCommentRegexp, '').replace(tagRegexp, '')
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
 * @param {Promise} taskP A Promise to measure
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
 * @param {TokenMap} dictionary Where the tokens will be dumped
 * @param {string[]} words Words used to generate the tokens
 * @param {string} fileName Name of the file used
 * @returns {Promise<void>}
 */
const dumpTokensToDictionary = async (dictionary, words, fileName) => {
    for (let word of words) {
        const hasWord = dictionary.get(word)
        if (!hasWord) {
            dictionary.set(word, { files: new Map(), postingIndex: -1 })
        }
        const hasFile = dictionary.get(word).files.get(fileName)
        if (hasFile) {
            dictionary.get(word).files.get(fileName).frequency++
        } else {
            dictionary.get(word).files.set(fileName, { frequency: 1 })
        }
    }
}

/**
 * 
 * @param {string} text Text to create the stop list from, words should be separated with a valid regex /s
 * @param {StopListMap} stopLMap Map to dump the keys and values to
 */
const createStopListMap = async (text, stopLMap) => {
    const cleanTxt = text.replace(/\r/g, '')
    const words = cleanTxt.split(/\s/)
    for (let word of words) {
        stopLMap.set(word, true)
    }
}

/**
 * Generates the Posting Array
 * @param {PostingArray} posting Where the posting data will be dumped
 * @param {TokenMap} tokenDictionary
 * @returns {Promise<void>}
 */
const dumpPostingToArray = async (posting, tokenDictionary) => {
    for (let [token, data] of tokenDictionary) {
        const postingIndex = posting.length // Index does not exist, will be created later

        for (let [fileName, fileData] of data.files) {
            posting.push({ fileName, frequency: fileData.frequency })
        }
        tokenDictionary.get(token).postingIndex = postingIndex
    }
}



/**
 * 
 * @param {string} documentsDir location of the HTML documents
 * @param {string} outputDir location for the generated files
 * @param {*} outputStream the write stream for the log file
 */
const main = async (documentsDir, outputDir, outputStream) => {
    // @ts-ignore
    let t_operation_total_ns = 0n // This will be the sum for the time taken to generate each file
    const MIN_TOKEN_REPS = 3
    /**
     * @type {TokenMap} global_dictionary Includes all the tokens from all the files
     */
    const global_dictionary = new Map()
    const main_sub = async () => {
        try {
            await fs.promises.mkdir(outputDir)
        } catch (err) {
            if (err.code !== ERR_EEXIST) {
                throw err
            }
        }

        const fileList = await fs.promises.readdir(documentsDir)
        for (let fileName of fileList) {
            const operation = async () => {
                const file = await fs.promises.readFile(path.join(documentsDir, fileName))
                const file_noHTML = await removeHTMLTags(file.toString())
                let words = await listWords(file_noHTML)
                words = words.map(word => word.toLowerCase()) // Set the words to lowercase
                await dumpTokensToDictionary(global_dictionary, words, fileName)
            }
            const timedResult = await measureTime_nano(operation())
            const log = `${fileName}\t${Number(timedResult.time) / 1000000000} s.\n`
            outputStream.write(log)
            t_operation_total_ns += timedResult.time
        }
        /**
         * @type {StopListMap}
         */
        const stopLMap = new Map()
        const stoplist_text = await fs.promises.readFile(path.join(__dirname, 'stoplist.txt'))
        await createStopListMap(stoplist_text.toString(), stopLMap)
        for (let word of stopLMap.keys()) {
            // We'll just delete every word from the stop list, no need to check
            global_dictionary.delete(word)
        }
        for (let token of global_dictionary.keys()) {
            // Here we'll perform filter any tokens
            if (token.length <= 1) {
                global_dictionary.delete(token)
                continue
            }
            const tokenData = global_dictionary.get(token)
            let reps = 0
            for (let fileData of tokenData.files.values()) {
                reps += fileData.frequency
                if (reps >= MIN_TOKEN_REPS) {
                    break
                }
            }
            if (reps < MIN_TOKEN_REPS) {
                global_dictionary.delete(token)
                continue
            }
        }
        /**
         * @type {PostingArray}
         */
        const posting_data = [] // Might be global in the future
        await dumpPostingToArray(posting_data, global_dictionary)
        const posting_file = posting_data
            .map(postData => `${postData.fileName}\t${postData.frequency}`)
            .join('\n')
        const tokens_file = Array.from(global_dictionary.keys())
            .map(token => `${token}\t${global_dictionary.get(token).files.size}\t${global_dictionary.get(token).postingIndex}`)
            .join('\n')

        await fs.promises.writeFile(
            path.join(outputDir, "posting.txt"),
            posting_file
        )
        await fs.promises.writeFile(
            path.join(outputDir, "tokens.txt"),
            tokens_file
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

const ACT = `a9`
main(
    HTML_FILES_LOCATION,
    path.join(__dirname, 'output', ACT),
    fs.createWriteStream(path.join(__dirname, 'output', `${ACT}_${STUDENT_ID}.txt`))
)

/** TYPES */
/**
 * @typedef {object} FileUsageData
 * @property {number} frequency
 *
 * @typedef {object} TokenData
 * @property {FileUsageMap} files
 * @property {number} postingIndex This token's first index of the posting array
 *
 * @typedef {Map<string,FileUsageData>} FileUsageMap
 *
 * @typedef {Map<string, TokenData>} TokenMap
 *
 * @typedef {object} PostingData
 * @property {string} fileName
 * @property {number} frequency
 *
 * @typedef {PostingData[]} PostingArray
 *
 * @typedef {object} SimpleTokenData
 * @property {number} postingIndex This token's first index of the posting array
 * @property {number} docs Number of documents with this token
 *
 * @typedef {Map<string,SimpleTokenData>} SimpleTokenMap
 *
 * @typedef {Map<string,boolean>} StopListMap
 */