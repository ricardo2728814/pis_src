const fs = require('fs')
const path = require('path')
const stream = require('stream')
const HTML_FILES_DIR_NAME = 'Files'
const HTML_FILES_LOCATION = path.join(__dirname, HTML_FILES_DIR_NAME)

const STUDENT_ID = 2728814

const a1 = async (filesLocation, outputStream) => {
    const t_begin_p = new Date()
    let t_total_files = 0
    const output = []
    const operations = []
    const fileList = await fs.promises.readdir(filesLocation)
    for (let i = 0; i < fileList.length; i++) {
        let currentFileLocation = path.join(filesLocation, fileList[i])
        const t_begin = new Date()
        operations.push(
            await fs.promises.readFile(currentFileLocation).then((buff) => {
                const t_end = new Date()
                const t_diff = t_end.getTime() - t_begin.getTime()
                t_total_files += t_diff
                const log = `${fileList[i]}\t${t_diff / 1000} s.\n`
                output.push(log)
            }, err => { throw err })
        )
    }
    await Promise.all(operations)
    output.forEach(el => outputStream.write(el))
    const t_end_p = new Date()
    const t_total = t_end_p.getTime() - t_begin_p.getTime()
    outputStream.write(`Total reading time:\t${t_total_files / 1000} s\n`)
    outputStream.write(`Total execution time:\t${t_total / 1000} s\n`)
    outputStream.close()
}

a1(
    HTML_FILES_LOCATION,
    fs.createWriteStream(path.join(__dirname, 'output', `a1_${STUDENT_ID}.txt`))
)