import { default as fetch } from 'node-fetch';
import * as xml2json from 'xml2json';

import { DefaultObject, Utils } from "../utils";
import { CsvStatementExtractor } from './'
import { parse as parseDate } from 'date-fns';
import { StatementExtractorFactory } from "./StatementExtractorFactory";
import { 
    BankTransaction, 
    BankTransactionTransactionTypeEnum,
    BrokerageRealizedLot, 
    BrokerageHolding,
    BrokerageTransactionStatusEnum, 
    BrokerageTransactionTransactionTypeEnum, 
    BrokerageTransaction,
    Statement } from '../gen/finance/models';

export class InteractiveBrokers
{
    public static institutionName = "Interactive Brokers";
    private static flexServiceUrl = "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService";

    public static symbolToOccCode(symbol: string)
    {
        return symbol.replace(/\s/g, '');
    }

    public static async runFlexQuery(token: string, query: string)
    {
        // get reference code
        let referenceCode:string = null;
        {
            let url = `${this.flexServiceUrl}.SendRequest?t=${token}&q=${query}&v=3`;
            let res = await fetch(url);

            let l = xml2json.toJson(await res.text(), { 
                coerce: false, 
                arrayNotation: false,
                object: true
            }) as any;
            referenceCode = l["FlexStatementResponse"]["ReferenceCode"] as string;
        }

        // get the statement
        while (true)
        {
            let url = `${this.flexServiceUrl}.GetStatement?t=${token}&q=${referenceCode}&v=3`;
            let response = await fetch(url);
            let contentType = response.headers.get("Content-Type");
            if (contentType == "text/xml") {
                let xml = await(response.text());
                let json = xml2json.toJson(xml, { coerce: false, arrayNotation: false, object: true});
                let errorMessage:string = (json["FlexStatementResponse"] as DefaultObject)["ErrorMessage"] as string;
                if (errorMessage.indexOf("try again") >= 0) {
                    // wait 5 seconds if should retry
                    console.log(`Interactive brokers flex api returned ${errorMessage}. Retrying...`);
                    await new Promise(r => setTimeout(r, 5000));
                }
                else {
                    throw `Flex query returned error ${xml}`;
                }
            }
            else {
                return await (await(fetch(url))).text();
            }
        }
    }
}

export class InteractiveBrokersCsvExtractor extends CsvStatementExtractor
{
    private static r = StatementExtractorFactory.registerStatementCsvExtractorClass(InteractiveBrokersCsvExtractor.prototype);

    private startDate: Date;
    private endDate: Date;
    private statements: Statement[];
    private statementMap:{[key:string]: Statement};

    public constructor()
    {
        super();
        this.statements = [];
        this.statementMap = {};
    }

    private statementForRow(row: DefaultObject): Statement {
        let accountNumber = row["ClientAccountID"];
        if (accountNumber.length == 0)
            return null;

        if (accountNumber in this.statementMap) {
            return this.statementMap[accountNumber];
        }

        let statement:Statement = {
            accountNumber: row["ClientAccountID"],
            startDate: this.startDate,
            endDate: this.endDate,
            institutionName: InteractiveBrokers.institutionName,
            brokerageHoldings: [],
            brokerageTransactions: [],
            bankTransactions: [],
            brokerageRealizedLots: []
        }

        this.statements.push(statement);
        this.statementMap[accountNumber] = statement;
        return statement;
    }

    private holdingForRow(row: DefaultObject): BrokerageHolding {
        return {
            costBasis: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["CostBasisMoney"])},
            quantity: parseInt(row["Quantity"]),
            symbol: InteractiveBrokers.symbolToOccCode(row["Symbol"]),
            value: { 
                start: { currencyCode: row["CurrencyPrimary"], value: 0 },
                end: { currencyCode: row["CurrencyPrimary"], value: 0 },
            }
        }
    }

    private transactionSettleDate(row: DefaultObject)
    {
        for (let i in ["SettleDate", "SettleDateTarget"]) {
            if (i in row) {
                return row[i];
            }    
        }
        throw `Settle Date Not Found`;
    }

    private transactionForRow(row: DefaultObject): BrokerageTransaction {
        return {
            amount: { 
                currencyCode: row["CurrencyPrimary"], 
                value: (() => { 
                    if ("NetCash" in row)
                        return Utils.normalizeNumberStringToNumber(row["NetCash"]);
                    return Utils.normalizeNumberStringToNumber(row["Proceeds"]); 
                })() 
            },
            commission: {
                currencyCode: row["CurrencyPrimary"], 
                value: (() => {
                    if ("NetCash" in row)
                        return 0;
                    return Utils.normalizeNumberStringToNumber(row["Commission"]) ;
                })()
            },
            quantity: parseFloat(row["Quantity"]),
            tradeDate: parseDate(Utils.fallbackKeyValue(row, ["Date/Time", "DateTime"]), "yyyyMMdd;HHmmss", new Date()),
            settlementDate: parseDate(Utils.fallbackKeyValue(row, ["SettleDate","SettleDateTarget"]), "yyyyMMdd", new Date()),
            price: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(Utils.fallbackKeyValue(row, ["Price","TradePrice"])) },
            symbol: InteractiveBrokers.symbolToOccCode(row["Symbol"]),
            status: BrokerageTransactionStatusEnum.Settled,
            transactionType: Utils.normalizeNumberStringToNumber(row["Quantity"]) > 0 
                ? BrokerageTransactionTransactionTypeEnum.Purchase 
                : BrokerageTransactionTransactionTypeEnum.Sale
        }
    }

    private positionClosed(row:DefaultObject):boolean
    {
        return Utils.fallbackKeyValue(row, ["Open/CloseIndicator"]).indexOf("C") >= 0;
    }

    private processRealizedLots(rows:DefaultObject[], rowIndex: number, closedLot: BrokerageTransaction): BrokerageRealizedLot[]
    {
        // IB includes the lots with the original cost basis after the row with the sell order. 
        let ret: BrokerageRealizedLot[] = [];
        let originalRow = rows[rowIndex];
        let remainingQuantity = closedLot.quantity;
        for (let j = rowIndex + 1; j < rows.length && remainingQuantity != 0; j = j + 1) {
            let row = rows[j];
            let isClosed = this.positionClosed(row);
            if (isClosed
                && row["ClientAccountID"] == originalRow["ClientAccountID"]
                && row["Symbol"] == originalRow["Symbol"] 
                && row["TransactionType"].length == 0 
                && Utils.fallbackKeyValue(row, ["OpenDateTime"]).length > 0)
            {
                let quantity = Utils.normalizeNumberStringToNumber(row["Quantity"]);
                ret.push({
                    acquisitionAmount:  { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["CostBasis"]) },
                    acquisitionDate: parseDate(row["OpenDateTime"], "yyyyMMdd;HHmmss", new Date()),
                    acquisitionPrice:  { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["TradePrice"]) },
                    description: closedLot.description,
                    liquidationAmount: { currencyCode: closedLot.amount.currencyCode, value: (closedLot.amount.value * quantity) / (-1 * closedLot.quantity) },
                    liquidationDate: closedLot.tradeDate,
                    liquidationPrice: closedLot.price,
                    quantity: quantity,
                    symbol: closedLot.symbol
                });
                remainingQuantity += quantity;
            }
            else 
            {
                break;
            }
        }

        // some lots simultaneously open and close positions (such as a roll), in this case the quantity won't match up.
        if (remainingQuantity != 0 && originalRow["Open/CloseIndicator"] != "C;O") {
            throw `Not all the original lots found for ${closedLot.tradeDate} ${closedLot.symbol}`;
        }

        return ret;
    }

    private bankTransactionForRow(row: DefaultObject): BankTransaction {
        return {
            amount: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["Amount"]) },
            transactionType: parseInt(row["Amount"]) >= 0 
                ? BankTransactionTransactionTypeEnum.Credit
                : BankTransactionTransactionTypeEnum.Debit,
            description: row["Description"],
            category: row["Type"],
            postedDate: parseDate(row["Date/Time"], "yyyyMMdd;HHmmss", new Date())
        }
    }

    private gCashBrokerageTransactionType:{ [str:string]: BrokerageTransactionTransactionTypeEnum } = {
        "Dividends" : BrokerageTransactionTransactionTypeEnum.Dividend,
        "Broker Interest Received": BrokerageTransactionTransactionTypeEnum.Interest,
        "Other Fees": BrokerageTransactionTransactionTypeEnum.Fee
    }

    private cashToBrokerageTransaction(row: DefaultObject): BrokerageTransaction {
        if (!(row["Type"] in this.gCashBrokerageTransactionType)) {
            return null;
        }

        return {
            amount: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["Amount"]) },
            commission: { currencyCode: row["CurrencyPrimary"], value: 0 },
            description: row["Description"],
            quantity: 0,
            settlementDate: parseDate(row["SettleDate"], "yyyyMMdd", new Date()),
            price: { currencyCode: row["CurrencyPrimary"], value: 0 },
            status: BrokerageTransactionStatusEnum.Settled,
            transactionType: this.gCashBrokerageTransactionType[row["Type"]],
            tradeDate: parseDate(row["Date/Time"], "yyyyMMdd;HHmmss", new Date()),
            symbol: row["Symbol"]
        };
    }

    private groupByCode(data: string[][]) {
        let ret:{[key:string]: DefaultObject[]} = {};
        let section: DefaultObject[];
        let columns: string[];
        for (let i = 0; i < data.length; i++) {
            let row = data[i];
            let state = row[0];
            if (state == "BOS") {
                let code = row[1].toString();
                if (code in ret) {
                    section = ret[code];
                }
                else {
                    section = ret[code] = [];
                }
            }
            else if (state == "HEADER") {
                columns = row.slice(2);
            }
            else if (state == "DATA") {
                section.push(Utils.rowToJson(row.slice(2), columns));
            }
            else if (state == "EOS") {
                columns = null;
                section = null;
            }
        }
        return ret;
    }

    public process(csv: string)
    {
        let data = Utils.parseCsvTrim(csv);
        let bof = data[0];

        if (bof[0] != "BOF") {
            return null;
        }
       
        this.startDate = parseDate(bof[4], "yyyyMMdd", new Date());
        this.endDate = parseDate(bof[5], "yyyyMMdd", new Date());
        let groups = this.groupByCode(data);
        let ret:Statement[] = [];

        if ("POST" in groups) {
            groups["POST"].forEach((row) => {
                let statement = this.statementForRow(row);
                if (statement != null) {
                    statement.brokerageHoldings.push(this.holdingForRow(row));
                }
            });
        }
        if ("CONF" in groups) {
            groups["CONF"].forEach(row => {
                let statement = this.statementForRow(row);
                if (statement != null) {
                    statement.brokerageTransactions.push(this.transactionForRow(row));
                }
            });
        }
        if ("TRNT" in groups) {
            let rows = groups["TRNT"];
            for (let i = 0; i < rows.length; i = i + 1) {
                let row = rows[i];
                let statement = this.statementForRow(row);
                if ("TransactionType" in row && row["TransactionType"] == "ExchTrade") {
                    let transaction = this.transactionForRow(row);
                    statement.brokerageTransactions.push(transaction);
                    // Each closed lot can be followed by one or lots that describe how the lot was opened
                    let isClosed = this.positionClosed(row);
                    if (isClosed) {
                        statement.brokerageRealizedLots.push(...this.processRealizedLots(rows, i, transaction));
                    }
                }
            }
        }
        if ("CTRN" in groups) {
            groups["CTRN"].forEach(row => {
                let statement = this.statementForRow(row);
                if (statement != null) {
                    statement.bankTransactions.push(this.bankTransactionForRow(row));
                    let t = this.cashToBrokerageTransaction(row);
                    if (t != null) {
                        statement.brokerageTransactions.push(t);
                    }
                }
            })
        }
        return this.statements;
    }

    public canProcess(csv: string)
    {
        return csv.indexOf("ClientAccountID") >= 0;
    }

    public institutionName()
    {
        return InteractiveBrokers.institutionName;
    }
}
