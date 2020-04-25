// @ts-check
const fs = require('fs')
const path = require('path')
const repl = require('repl')
const HTML_FILES_DIR_NAME = 'Files'
const HTML_FILES_LOCATION = path.join(__dirname, HTML_FILES_DIR_NAME)
const ERR_EEXIST = 'EEXIST'
const MSG_ERR_FOLDER_CREATION = folder => `Failed to make directory ${folder}.`
const OUTPUT_FOLDER = path.join(__dirname, 'output')
const STUDENT_ID = 2728814
const ACT = `a12`
const MIN_TOKEN_REPS = 2
const MAX_TOKEN_LENGTH = 32
const STRING_ENCODING = 'utf8'
let STOP_LIST_ENABLED = true
let INTERACTIVE_MODE = false
let USE_MEMORY = false

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

const readParams = () => {
    const commands = process.argv.slice(2)
    for (let command of commands) {
        switch (command) {
            case '-i':
                INTERACTIVE_MODE = true
                break;
            case '-nostoplist':
                STOP_LIST_ENABLED = false
                break;
            case '-memory':
                USE_MEMORY = true
                break;
            default:
                console.log(`Unknown: ${command}`)
                break;
        }
    }
}
readParams()

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
 *  Creates a sync counter
 */
const createCounter = () => {
    const t_begin = process.hrtime.bigint()
    const stop = () => {
        const t_end = process.hrtime.bigint()
        return t_end - t_begin
    }
    return { stop }
}

/**
 * 
 * @param {bigint} ns 
 */
const ns_to_s = (ns) => Number(ns) / 1000000000

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
 * @param {number} fileID Name of the file used
 * @returns {Promise<void>}
 */
const dumpTokensToDictionary = async (dictionary, words, fileID) => {
    for (let word of words) {
        const hasWord = dictionary.get(word)
        if (!hasWord) {
            dictionary.set(word, { files: new Map(), postingIndex: -1 })
        }
        const hasFile = dictionary.get(word).files.get(fileID)
        if (hasFile) {
            dictionary.get(word).files.get(fileID).frequency++
        } else {
            dictionary.get(word).files.set(fileID, { frequency: 1 })
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
 * 
 * @param {FileUsageData} fileData
 * @param {number} tokensOnDoc
 * @returns {Promise<number>}
 */
const calculateWeight = async (fileData, tokensOnDoc) => {
    return (fileData.frequency * 100) / tokensOnDoc
}

/**
 * Generates the Posting Array
 * @param {PostingArray} posting Where the posting data will be dumped
 * @param {TokenMap} tokenDictionary
 * @param {DocumentTokenCountMap} docsTokens
 * @returns {Promise<void>}
 */
const dumpPostingToArray = async (posting, tokenDictionary, docsTokens) => {
    for (let [token, data] of tokenDictionary) {
        const postingIndex = posting.length // Index does not exist, will be created later

        for (let [fileID, fileData] of data.files) {
            posting.push({ fileID, weight: await calculateWeight(fileData, docsTokens.get(fileID)) })
        }
        tokenDictionary.get(token).postingIndex = postingIndex
    }
}

/**
 * @class
 * @template TKey
 * @template TValue
 */
class RMap {
    /**
     * @param {Map<TKey, TValue>} data
    */
    constructor(data) {
        this.dataSet = data
    }

    /**@type {Map<TKey, TValue>}*/
    dataSet = new Map()

    /**@param {TKey} key */
    get = async (key) => this.dataSet.get(key)

}

/**
 * @class
 * @template TKey
 * @template TValue
 */
class PMap {

    /**@type {Map<TKey, TValue>}*/
    dataSet = new Map()

    /**@param {TKey} key */
    get = async (key) => this.dataSet.get(key)

}

/**
 * 
 * @param {PISData} data 
 */
const dumpToFiles = async data => {
    let streams = []
    // Documents
    const docs_file = path.join(OUTPUT_FOLDER, 'documents.pis.bin')
    let wStream = fs.createWriteStream(docs_file, { flags: 'w' })
    data.documents.forEach((docName) => {
        const bFileName = Buffer.alloc(32)
        bFileName.write(docName)

        wStream.write(bFileName)
    })
    wStream.close()
    streams.push(new Promise(fulfill => wStream.on("finish", fulfill)))

    // Posting
    const posting_file = path.join(OUTPUT_FOLDER, 'posting.pis.bin')
    wStream = fs.createWriteStream(posting_file, { flags: 'w' })
    data.posting.forEach((postData) => {
        const bID = Buffer.alloc(4)
        const bWeight = Buffer.alloc(8)
        bID.writeInt32BE(postData.fileID)
        bWeight.writeDoubleBE(postData.weight)

        wStream.write(bID)
        wStream.write(bWeight)
    })
    wStream.close()
    streams.push(new Promise(fulfill => wStream.on("finish", fulfill)))

    // Tokens
    const tokens_file = path.join(OUTPUT_FOLDER, 'tokens.pis.bin')
    wStream = fs.createWriteStream(tokens_file, { flags: 'w' })
    data.tokens.forEach((tokenData, tokenName) => {
        const bTokenName = Buffer.alloc(32)
        const bDocsNumber = Buffer.alloc(4)
        const bPostingIndex = Buffer.alloc(4)
        const writtenBytesTokenName = bTokenName.write(tokenName)
        if (writtenBytesTokenName === 32) throw "TOKEN REACHED MAX SIZE"
        bDocsNumber.writeInt32BE(tokenData.docs)
        bPostingIndex.writeInt32BE(tokenData.postingIndex)

        wStream.write(bTokenName)
        wStream.write(bDocsNumber)
        wStream.write(bPostingIndex)
    })
    wStream.close()
    streams.push(new Promise(fulfill => wStream.on("finish", fulfill)))

    /**
     * TokenToIndex
     * @type {Map<string, number>}
     */
    const tokenToIndexMap = new Map()
    Array.from(data.tokens.keys()).forEach((token, i) => tokenToIndexMap.set(token, i))

    // Readers

    /**
     * 
     * @param {string} tokenName 
     */
    const getToken = async tokenName => {
        let tokenNameClean = tokenName.toLowerCase()
        const bTokenName = Buffer.alloc(32)
        const bDocsNumber = Buffer.alloc(4)
        const bPostingIndex = Buffer.alloc(4)
        const index = tokenToIndexMap.get(tokenNameClean)
        if (typeof index !== 'number') {
            return
        }
        const row = (32 + 4 + 4) * index

        const fd = await fs.promises.open(tokens_file, 'r')
        await fd.read(bTokenName, 0, 32, row)
        await fd.read(bDocsNumber, 0, 4, row + 32)
        await fd.read(bPostingIndex, 0, 4, row + 36)
        fd.close() // wait?

        const tokenStringLength = bTokenName.indexOf(0x0)
        const tokenString = bTokenName.toString(STRING_ENCODING, 0, tokenStringLength)
        if (tokenString !== tokenNameClean) throw `Token matching error ${tokenNameClean} -> ${tokenString}`
        const docs = bDocsNumber.readInt32BE()
        const postingIndex = bPostingIndex.readInt32BE()
        /**@type {SimpleTokenData} */
        const tokenData = { docs, postingIndex }
        return tokenData
    }

    /**
     * 
     * @param {number} index 
     */
    const getPosting = async index => {
        const bID = Buffer.alloc(4)
        const bWeight = Buffer.alloc(8)

        const row = (4 + 8) * index

        const fd = await fs.promises.open(posting_file, 'r')
        await fd.read(bID, 0, 4, row)
        await fd.read(bWeight, 0, 8, row + 4)
        fd.close() // wait?

        const fileID = bID.readInt32BE()
        const weight = bWeight.readDoubleBE()

        /**@type {PostingData} */
        const postingData = { fileID, weight }
        return postingData
    }

    /**
     * 
     * @param {number} index 
     */
    const getDoc = async index => {
        const bFileName = Buffer.alloc(32)

        const fd = await fs.promises.open(docs_file, 'r')
        await fd.read(bFileName, 0, 32, index * 32)
        fd.close()
        const stringLength = bFileName.indexOf(0x0)
        const docName = bFileName.toString(STRING_ENCODING, 0, stringLength)
        return docName
    }

    await Promise.all(streams)

    let documents = new PMap()
    documents.get = getDoc
    let posting = new PMap()
    posting.get = getPosting
    let tokens = new PMap
    tokens.get = getToken

    /**@type {PISDataMap} */
    const DataMap = {
        documents,
        posting,
        tokens
    }
    return DataMap
}

const createDatabase = () => {
    const db = {}

    /**@type {PISDataMap} */
    let pisData

    /**@param {PISDataRaw} data */
    db.setData = async data => {
        /**@type {PostingMap} */
        const posting = new Map()

        /**@type {SimpleTokenMap} */
        const tokens = new Map()

        data.posting.forEach((el, i) => posting.set(i, el))
        data.tokens.forEach((tokenData, key) => {
            tokens.set(key, {
                postingIndex: tokenData.postingIndex,
                docs: tokenData.files.size
            })
        })
        if (USE_MEMORY) {
            pisData = {
                documents: new RMap(data.documents),
                posting: new RMap(posting),
                tokens: new RMap(tokens)
            }
        } else {
            pisData = await dumpToFiles({
                documents: data.documents,
                posting,
                tokens
            })
        }
    }

    db.transfer = async () => {

    }

    db.getData = async () => {
        return pisData
    }
    return db
}
const database = createDatabase()

/**
 * Creates a REPL instance in its own context
 */
let startRepl = () => { }
/**
 * Create REPL context
 */
const createReplContext = () => {
    /**@type {repl.REPLServer}*/
    let replInstance
    const pis = {}

    pis.restart = () => {
        console.log("RUNNING...")
        run().then(() => {
            console.log("DONE")
            startRepl()
        })
    }
    /**
     * @param {string} word
     */
    pis.search = async (word) => {
        const counter = createCounter()
        const wordClean = word.toLowerCase()
        const db = await database.getData()
        const match = await db.tokens.get(wordClean)
        if (!match) {
            console.log("No token found")
            return null
        }
        const iStart = match.postingIndex
        const iEnd = iStart + match.docs - 1
        let results = []
        for (let i = iStart; i <= iEnd; i++) {
            const fileID = (await db.posting.get(i)).fileID
            const fileName = await db.documents.get(fileID)
            results.push(
                { fileName }
            )
        }
        const time = counter.stop()
        Promise.resolve().then(async () => {
            const stream = await fs.createWriteStream(path.join(OUTPUT_FOLDER, ACT, "search.txt"), { flags: 'a' })
            let searchLog = `Search: ${word}\n`
            for (let result of results) {
                searchLog += `\t${result.fileName}\n`
            }
            searchLog += `\tStorage: ${USE_MEMORY ? "Memory" : "Physical"}\n`
            searchLog += `\tTime: ${ns_to_s(time)} s.\n`
            stream.write(searchLog)
            stream.close()
        })
        console.log(results)
        return results
    }
    startRepl = async () => {
        console.log("REPL Started")
        if (!replInstance) {
            replInstance = repl.start('> ')
        }
        Object.assign(replInstance.context, { pis })
    }

}
createReplContext()

/**
 * 
 * @param {string} documentsDir location of the HTML documents
 * @param {string} outputDir location for the generated files
 * @param {*} outputStream the write stream for the log file
 */
const main = async (documentsDir, outputDir, outputStream) => {
    // @ts-ignore
    let t_operation_total_ns = 0n // This will be the sum for the time taken to generate each file
    /**
     * @type {TokenMap} global_dictionary Includes all the tokens from all the files
     */
    const global_dictionary = new Map()
    /**
     * @type {DocumentTokenCountMap} doc -> number of tokens
     */
    const global_docs_tokens_qt = new Map()
    /**
     * @type {DocumentsIndex}
     */
    const global_docs_index = new Map()
    const main_sub = async () => {
        try {
            await fs.promises.mkdir(outputDir)
        } catch (err) {
            if (err.code !== ERR_EEXIST) {
                throw err
            }
        }

        const fileList = await fs.promises.readdir(documentsDir)
        let docs_current_index = -1 // Starts at 0
        for (let fileName of fileList) {
            docs_current_index++
            global_docs_index.set(docs_current_index, fileName)
            const fileID = docs_current_index
            const operation = async () => {
                const file = await fs.promises.readFile(path.join(documentsDir, fileName))
                const file_noHTML = await removeHTMLTags(file.toString())
                let words = await listWords(file_noHTML)
                words = words.map(word => word.toLowerCase()) // Set the words to lowercase
                await dumpTokensToDictionary(global_dictionary, words, fileID)
            }
            const timedResult = await measureTime_nano(operation())
            const log = `${fileName}\t${ns_to_s(timedResult.time)} s.\n`
            outputStream.write(log)
            t_operation_total_ns += timedResult.time
        }
        /**
         * @type {StopListMap}
         */
        const stopLMap = new Map()
        const stoplist_text = await fs.promises.readFile(path.join(__dirname, 'stoplist.txt'))
        await createStopListMap(stoplist_text.toString(), stopLMap)
        if (STOP_LIST_ENABLED) {
            for (let word of stopLMap.keys()) {
                // We'll just delete every word from the stop list, no need to check
                global_dictionary.delete(word)
            }
        }
        for (let [token, tokenData] of global_dictionary) {
            // Here we'll perform filter any tokens
            if (token.length <= 1) {
                global_dictionary.delete(token)
                continue
            }
            if (token.length > MAX_TOKEN_LENGTH) {
                global_dictionary.delete(token)
                continue
            }
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
            // Create a doc -> reps map
            for (let [doc, usage] of tokenData.files) {
                const qtTokens = global_docs_tokens_qt.get(doc)
                if (qtTokens) {
                    global_docs_tokens_qt.set(doc, qtTokens + usage.frequency)
                } else {
                    global_docs_tokens_qt.set(doc, usage.frequency)
                }
            }
        }
        /**
         * @type {PostingArray}
         */
        const posting_data = [] // Might be global in the future
        await dumpPostingToArray(posting_data, global_dictionary, global_docs_tokens_qt)
        const sFileName = fileID => global_docs_index.get(fileID)
        const posting_file = posting_data
            .map(postData => `${postData.fileID}\t${postData.weight}`)
            .join('\n')
        const tokens_file = Array.from(global_dictionary.keys())
            .map(token => `${token}\t${global_dictionary.get(token).files.size}\t${global_dictionary.get(token).postingIndex}`)
            .join('\n')
        const documents_o_file = Array.from(global_docs_index.keys())
            .map(fileID => `${fileID}\t${sFileName(fileID)}`)
            .join('\n')

        await fs.promises.writeFile(
            path.join(outputDir, "documents.txt"),
            documents_o_file
        )
        await fs.promises.writeFile(
            path.join(outputDir, "posting.txt"),
            posting_file
        )
        await fs.promises.writeFile(
            path.join(outputDir, "tokens.txt"),
            tokens_file
        )

        database.setData({
            documents: global_docs_index,
            posting: posting_data,
            tokens: global_dictionary
        })
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

const run = () => main(
    HTML_FILES_LOCATION,
    path.join(__dirname, 'output', ACT),
    fs.createWriteStream(path.join(__dirname, 'output', `${ACT}_${STUDENT_ID}.txt`))
)

run().then(() => {
    if (INTERACTIVE_MODE) {
        startRepl()
    }
})

/** TYPES */
/**
 * @typedef {object} FileUsageData
 * @property {number} frequency
 *
 * @typedef {object} TokenData
 * @property {FileUsageMap} files
 * @property {number} postingIndex This token's first index of the posting array
 *
 * @typedef {Map<DocumentID,FileUsageData>} FileUsageMap
 *
 * @typedef {Map<TokenString, TokenData>} TokenMap
 *
 * @typedef {object} PostingData
 * @property {DocumentID} fileID
 * @property {number} weight
 *
 * @typedef {PostingData[]} PostingArray
 *
 * @typedef {Map<string,boolean>} StopListMap
 * @typedef {Map<DocumentID, DocumentName>} DocumentsIndex
 * @typedef {Map<DocumentID,NumberOfTokens>} DocumentTokenCountMap
 *
 * @typedef {number} DocumentID
 * @typedef {number} NumberOfTokens
 * @typedef {string} DocumentName
 * @typedef {string} TokenString
 *
 * @typedef {object} SimpleTokenData
 * @property {number} postingIndex This token's first index of the posting array
 * @property {number} docs Number of documents with this token
 *
 * @typedef {Map<TokenString,SimpleTokenData>} SimpleTokenMap
 *
 * @typedef {Map<number, PostingData>} PostingMap
 *
 * @typedef {object} PISDataRaw
 * @property {TokenMap} tokens
 * @property {PostingArray} posting
 * @property {DocumentsIndex} documents
 *
 * @typedef {object} PISData
 * @property {SimpleTokenMap} tokens
 * @property {PostingMap} posting
 * @property {DocumentsIndex} documents
 *
 * @typedef {object} PISDataMap
 * @property {AMap<TokenString, SimpleTokenData>} tokens
 * @property {AMap<number, PostingData>} posting
 * @property {AMap<DocumentID, DocumentName>} documents
 *
 */

/**
 * @typedef {RMap<TMKey, TMValue> | PMap<TMKey, TMValue>} AMap
 * @template TMKey
 * @template TMValue
 *
 */
