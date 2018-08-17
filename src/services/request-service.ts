import PercyClientService from './percy-client-service'
import Axios from 'axios'
import logger, {logError} from '../utils/logger'
import unique from '../utils/unique-array'
import * as fs from 'fs'
import * as crypto from 'crypto'
import ResourceService from './resource-service'
// const retryAxios = require('retry-axios')

export default class RequestService extends PercyClientService {
  static localCopiesPath = './tmp/'
  requestsProcessed: Map<string, string> = new Map()

  async processManifest(requestManifest: string[]): Promise<any[]> {
    logger.info(`processing ${requestManifest.length} requests...`)

    let filteredRequestManifests = this.filterRequestManifest(requestManifest)
    logger.info(`filtered to ${filteredRequestManifests.length} requests...`)

    let localCopies = await this.createLocalCopies(filteredRequestManifests)

    let resourceService = new ResourceService()
    let resources = await resourceService.createResourcesFromLocalCopies(localCopies)

    return resources
  }

  filterRequestManifest(requestManifest: string[]): string[] {
    requestManifest = requestManifest.map(request => {
      return this.parseRequestPath(request)
    })

    return unique(requestManifest)
  }

  async createLocalCopies(requestManifest: string[]): Promise<Map<string, string>> {
    let localCopies: Map<string, string> = new Map()
    let requestPromises = []

    for (let request of requestManifest) {
      let requestPromise = new Promise(async (resolve, _reject) => {
        let localCopy = await this.makeLocalCopy(request)
        if (localCopy) {
          localCopies.set(request, localCopy)
        }
        resolve()
      })

      requestPromises.push(requestPromise)
    }

    await Promise.all(requestPromises)

    return localCopies
  }

  async makeLocalCopy(request: string): Promise<string | null> {
    let filename: string | null = null

    if (this.requestsProcessed.has(request)) {
      logger.info(`skipping request, local copy already present: '${request}'`)
      return this.requestsProcessed.get(request) || null
    } else {
      logger.info(`making local copy of request: ${request}`)
    }

    // let retryConfig = {
    //   retry: 2,
    //   retryDelay: 100,
    //   shouldRetry: () => true,
    // }

    // let interceptorId = retryAxios.attach()

    await Axios({
      method: 'get',
      url: request,
      responseType: 'arraybuffer',
      // raxConfig: retryConfig
    } as any).then(response => {
      if (response.data) {
        let sha = crypto.createHash('sha256').update(response.data, 'utf8').digest('hex')
        filename = RequestService.localCopiesPath + sha
        fs.writeFileSync(filename, response.data)

        this.requestsProcessed.set(request, filename)
      } else {
        logger.info(`skipping '${request}' - empty response body`)
      }
    }).catch(logError)

    // retryAxios.detach(interceptorId)

    return filename
  }
}
