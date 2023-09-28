if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const fs = require('fs')
const dayjs = require('dayjs')
const { mainModule } = require('process')

class FofaAPI {
  constructor(email, accessToken, page, size) {
    this.email = email
    this.accessToken = accessToken
    this.page = page
    this.size = size
  }

  async get(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return response.json()
    } catch (err) {
      console.log()
    }
  }

  // FOFA Search API
  async search(servicePattern_Encode) {
    try {
      const url = `https://fofa.info/api/v1/search/all?email=${this.email}&key=${this.accessToken}&qbase64=${servicePattern_Encode}&page=${this.page}&size=${this.size}&fields=ip,country,port,protocol,cert`
      const result = await this.get(url)
      const dataObject = result
      const totalPage = Math.ceil(result.size / this.size)
      if (totalPage > 1) {
        for (let page = 2; page <= totalPage; page++) {
          const nextUrl = `https://fofa.info/api/v1/search/all?email=${this.email}&key=${this.accessToken}&qbase64=${servicePattern_Encode}&page=${page}&size=${this.size}&fields=ip,country,port,protocol,cert`
          const nextResult = await this.get(nextUrl)

          dataObject.results.push(...nextResult.results)
        }
      }

      return dataObject
    } catch (err) {
      console.log(err)
    }
  }

  // FOFA Host API
  async host(host) {
    try {
      const url = `https://fofa.info/api/v1/host/${host}?detail=true&email=${this.email}&key=${this.accessToken}`
      const result = await this.get(url)

      return result
    } catch (err) { 
      console.log(err)
    }
  }

  // FOFA Stats API
  async stats(fields, servicePattern_Encode) {
    const url = `https://fofa.info/api/v1/search/stats?fields=${fields}&qbase64=${servicePattern_Encode}&email=${this.email}&key=${this.accessToken}`
    const result = await this.get(url)

    return result
  }

  async searchCustomization(servicePattern_Encode) {
    try {
      const [searchResult, statsResult] = await Promise.all([
        this.search(servicePattern_Encode),
        this.stats('country', servicePattern_Encode)
      ])
      console.log('Fetch API Is Finished!')

      const dataObject = {}
      dataObject.total = 0
      dataObject.country = statsResult.aggs.countries.map(country => ({
        'count': 0,
        'value': country.name_code
      }))

      dataObject.data = []
      searchResult.results.forEach(result => {
        if (!dataObject.data.find(({ ip }, index) => {
          if (ip === result[0]) {
            dataObject.data[index].services.push(
              { 
                'port': result[2],
                'extended_service_name': result[3],
                ...result[4] ? { 'certificate': result[4] } : {}
              }
            )
            return true
          }
        })) { 
          dataObject.data.push(
            {
            'ip': result[0],
              'country': result[1],
              'services': [{ 
                'port': result[2],
                'extended_service_name': result[3],
                ...result[4] ? { 'certificate': result[4] } : {}
              }]
            }
          )
          
          dataObject.country.find(({ value }, index) => {
            if (value === result[1]) {
              dataObject.country[index].count += 1
            }
          })
        }
      })

      dataObject.total = dataObject.data.length
      return dataObject
    } catch (err) {
      console.log(err)
    }
  }

  // 輸出檔案
  async writeFile(payloads) {
    try {
      await fs.promises.appendFile(`./files/${dayjs().format('YYYY-MM-DD')}.json`, JSON.stringify(payloads))
    } catch (err) {
      console.log(err)
    }
  }
}

async function main() {
  const email = process.env.EAMIL
  const accessToken = process.env.ACCESS_TOKEN
  const page = 1
  const size = 100 // the maximum size per page is 10,000.
  const fofaAPI = new FofaAPI(email, accessToken, page, size)

  const servicePattern = ''
  const servicePattern_Encode = btoa(servicePattern) // base64 encode
  await fofaAPI.writeFile(await fofaAPI.searchCustomization(servicePattern_Encode))
}

main()
