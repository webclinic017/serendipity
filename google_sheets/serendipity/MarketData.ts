export class MarketData
{
  // URL For the unofficial yahoo finance API
  private static sBaseUrl:string = "https://query1.finance.yahoo.com/v8/finance/chart/";
    
  private static objectToUrl(obj: any): string 
  {
      return Object.keys(obj).reduce(
          function(p, e, i) {
              return p + (i == 0 ? "?" : "&") +
                  (Array.isArray(obj[e]) ? obj[e].reduce(function(str: string, f:string, j:number) {
                      return str + e + "=" + encodeURIComponent(f) + (j != obj[e].length - 1 ? "&" : "")
                  },
                  "") : e + "=" + encodeURIComponent(obj[e]));
          },
          ""
      );
  }

  private static buildUrl(symbol: string, startDate: Date, endDate: Date, interval:string="1d")
  {
    let url = MarketData.sBaseUrl + symbol;
    let params = {
      "period1": startDate.getTime() / 1000, 
      "period2": endDate.getTime() / 1000,
      "interval": interval.toLowerCase(), 
      "events": "div,splits"
    };
    return url + MarketData.objectToUrl(params);
  }

  public static lastPrice(symbol:string): number {
    let endDate = new Date()
    let startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDay() - 1);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDay() + 1)
    let response = UrlFetchApp.fetch(MarketData.buildUrl(symbol, startDate, endDate)); 
    let json = JSON.parse(response.getContentText());
    let price = json.chart.result[0].meta.regularMarketPrice;
    return parseFloat(price);
  }

  /**
   * Fetch the last prices for a list of symbols.
   * 
   * Note: This method seems to work better with Google sheets integration. Fetching one symbol at a time
   * is resulting in some symbols not being loaded.
   */
  public static lastPrices(symbols:string[]): number[] {
    let endDate = new Date()
    let startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDay() - 1);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDay() + 1);
    let requests:GoogleAppsScript.URL_Fetch.URLFetchRequest[] = [];
    symbols.forEach((s: string) => {
      requests.push({
        url: (MarketData.buildUrl(s, startDate, endDate)),
        muteHttpExceptions: true
      });
    });
    let responses = UrlFetchApp.fetchAll(requests);  
    let prices:number[] = [];
    responses.forEach((r) => {
      let price:number = 0;
      let text = r.getContentText();
      let json = JSON.parse(text);
      if ("chart" in json) {
        let chart = json.chart;
        if (chart != null && "result" in chart) {
          let result = chart.result;
          if (result != null && result.length > 0) {
            price = parseFloat(json.chart.result[0].meta.regularMarketPrice);
          }
        }
      }
      prices.push(price);
    });
    return prices;
  }

  public static updateAllCurrentPricesInSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet)
  {
    let dataRange = sheet.getDataRange();
    let data = dataRange.getValues();
    let symbolIndex = -1;
    let currentPriceIndex = -1;
    let cols = data[0];

    for (let i = 0; i < cols.length; ++i) {
      let c = cols[i];
      if (c == null)
        continue;
      c = c.toLowerCase();
      if (c == "symbol") {
        symbolIndex = i;
      }
      else if (c == "current price") {
        currentPriceIndex = i;
      }
    }
    
    if (symbolIndex < 0 || currentPriceIndex < 0) {
      return;
    }
    
    for (let i = 1; i < data.length; ++i) {
      let symbol = data[i][symbolIndex];
      if (symbol.length > 0) {
        let price = MarketData.lastPrice(symbol);
        dataRange.getCell(i + 1, currentPriceIndex + 1).setValue([price]);
      }
    }
  }

  public static updateAllCurrentPricesInSpreadsheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet)
  {
    let s = SpreadsheetApp.getActiveSpreadsheet();
    let sheets = s.getSheets();
    for (let i = 0; i < sheets.length; ++i) {
      let sheet = sheets[i];
      MarketData.updateAllCurrentPricesInSheet(sheet);
    }
  }
}

export function TestAll()
{
  testMarketDataLastPrice();
  testMarketDataLastPrices();
}

function testMarketDataLastPrice()
{
    let p = MarketData.lastPrice("TSLA");
    if (!(p > 0)) {
        throw "Test Failure: Expecting price to be a non-zero float";
    }
}

function testEqual(expected:any, actual:any, name:string)
{
  if (expected != actual) {
    throw `Test Failure: ${name} expected:${expected} actual:${actual}`;
  }
}

function testMarketDataLastPrices()
{
  let symbols:string[] = ["TSLA","ROKU","BYND", "INVALID_SYMBOL"];
    let p = MarketData.lastPrices(symbols);
    testEqual(p.length, 4, "Number of returned responses");
    for (var i:number = 0; i < 3; i = i + 1) {
      if (p[i] <= 0) {
        throw `Test Failure: Expected price of ${symbols[i]} to be greater than 0`; 
      }
    }
    testEqual(p[p.length - 1], 0, `Price of ${symbols[p.length - 1]}`);
}
