const http = require('http')
const querystring = require('querystring')

const searches = [
    "cdt testimony",
    "halo",
    "cdt",
    "20",
    "csce",
    "finally",
    "favored",
    "study",
    "science",
    "sgauch",
    "laws",
    "costos",
    "Name",
    "physical Education",
    "Title",
    "woman",
    "woman halo name laws science finally wdith"
]

const USERS = 5 // Concurrency
const SEARCHES = 2 // Searches for each user
const START_DELAY_MS = 2000 // Time to start
const DELAY_SEARCH_MS = 0 // How long should the user wait after a search to search again?
const LOG_SINGLE_REQUEST = true // Log every request?

const HOSTNAME = "localhost"
const time_log = []
const error_log = []

const init = async () => {
    const usersP = []
    for (let i = 0; i < USERS; i++) {
        usersP.push(startUser(i)) // Do not wait
    }
    await Promise.all(usersP)
    const longest = Math.max(...time_log)
    console.log(`${USERS} users, ${SEARCHES} searches each.`)
    console.log("Longest request time was " + ns_to_s(longest) + " seconds")
    console.log("Errors: " + error_log.length)
}

const startUser = async (id) => {
    for (let i = 0; i < SEARCHES; i++) {
        const searchString = searches[Math.ceil(Math.random() * searches.length) - 1]
        const counter = createCounter()
        let parsedResponse
        try {
            parsedResponse = await search(searchString)
        } catch (err) {
            error_log.push(err)
            continue
        }
        const time = counter.stop()
        let seconds = ns_to_s(time).toString().slice(0, 10)
        time_log.push(Number(time))
        if (LOG_SINGLE_REQUEST) console.log(`USER ${id}\tRESULTS:${parsedResponse.length}\tTIME:${seconds}\tSEARCHING ${searchString}`)
        if (DELAY_SEARCH_MS > 0) await wait(DELAY_SEARCH_MS)
    }
}

const search = (search) => {
    const query = querystring.encode({ q: search })
    const path = `/api/search?${query}`
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: HOSTNAME,
            port: 80,
            path,
            method: "GET"
        }, (res) => {
            res.setEncoding('utf8');
            const chunks = []
            res.on('data', chunk => {
                chunks.push(chunk)
            })
            res.on('end', () => {
                resolve(JSON.parse(chunks.join('')))
            })
        })
        req.on('error', err => {
            reject(err)
        })
        req.end()
    })

}

const createCounter = () => {
    const t_begin = process.hrtime.bigint()
    const stop = () => {
        const t_end = process.hrtime.bigint()
        return t_end - t_begin
    }
    return { stop }
}

const wait = (time) => new Promise(resolve => {
    setTimeout(() => resolve(), time)
})

const ns_to_s = (ns) => Number(ns) / 1000000000

setTimeout(init, START_DELAY_MS)