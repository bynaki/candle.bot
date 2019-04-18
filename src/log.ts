import Logger from 'fourdollar.logger'
import FileWriter from 'fourdollar.filewriter'
import {
  join,
} from 'path'


Logger.writer.link = new FileWriter(join(__dirname, 'log/access.log'), '1d')
Logger.format = ':time: > [:name:] :msg:'

export default Logger
// export const logger = new Logger('Internal')