import { default as fetch } from 'node-fetch';
import * as xml2json from 'xml2json';

import { DefaultObject, Utils } from "../utils";
import { CsvStatementExtractor } from './'
import { parse as parseDate } from 'date-fns';
import {  StatementExtractorFactory } from "./StatementExtractorFactory";
import { 
    BankTransaction, 
    BankTransactionTransactionTypeEnum,
    BrokerageRealizedLot, 
    BrokerageHolding,
    BrokerageTransactionStatusEnum, 
    BrokerageTransactionTransactionTypeEnum, 
    BrokerageTransaction,
    PriorMtmPosition,
    Statement, 
    Money} from '../gen/finance/models';

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

        // get the statement. retry every timeout seconds for errors that can be retried and bail if not. 
        let timeoutSecs:number = 5;
        let url = `${this.flexServiceUrl}.GetStatement?t=${token}&q=${referenceCode}&v=3`;
        while (true)
        {
            let response = await fetch(url);
            let text = await response.text();
            let contentType = response.headers.get("Content-Type");
            if (contentType == "text/xml") {
                let json = xml2json.toJson(text, { coerce: false, arrayNotation: false, object: true});
                let errorMessage:string = (json["FlexStatementResponse"] as DefaultObject)["ErrorMessage"] as string;
                if (errorMessage.indexOf("try again") >= 0) {
                    // wait 5 seconds if should retry
                    await new Promise(r => setTimeout(r, timeoutSecs*1000));
                }
                else {
                    throw `Flex query returned error ${text}`;
                }
            }
            else {
                return text;
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
            brokerageRealizedLots: [],
            priorMtmPositions: []
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

    private getDateTime(row: DefaultObject)
    {
        return parseDate(Utils.fallbackKeyValue(row, ["Date/Time", "DateTime"]), "yyyyMMdd;HHmmss", new Date());
    }

    private transactionForRow(row: DefaultObject): BrokerageTransaction {
        let realizedPnlStr = Utils.firstNonEmptyValue(row, ["FifoPnlRealized"]);
        let mtmPnlStr = Utils.firstNonEmptyValue(row, ["MtmPnl"]);
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
                value:  Utils.normalizeNumberStringToNumber(Utils.fallbackKeyValue(row,["IBCommission", "Commission"]))
            },
            quantity: parseFloat(row["Quantity"]),
            tradeDate: this.getDateTime(row),
            settlementDate: parseDate(Utils.firstNonEmptyValue(row, ["SettleDate","SettleDateTarget","TradeDate"]), "yyyyMMdd", new Date()),
            price: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(Utils.fallbackKeyValue(row, ["Price","TradePrice"])) },
            symbol: InteractiveBrokers.symbolToOccCode(row["Symbol"]),
            status: BrokerageTransactionStatusEnum.Settled,
            transactionType: Utils.normalizeNumberStringToNumber(row["Quantity"]) > 0 
                ? BrokerageTransactionTransactionTypeEnum.Purchase 
                : BrokerageTransactionTransactionTypeEnum.Sale,
            realizedPnl: realizedPnlStr != null ? { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(realizedPnlStr) } : null,
            mtmPnl: mtmPnlStr != null ? { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(mtmPnlStr) } : null
        };
    }

    private positionClosed(row:DefaultObject):boolean
    {
        return Utils.fallbackKeyValue(row, ["Open/CloseIndicator"]).indexOf("C") >= 0;
    }

    // To process realized lots, for each execution that's closed process the closed lots and the wash sales.
    //
    // TODO: this is incomplete due ot handling of wash sales. The cost basis of specific lots 
    // is likely to be incorrect when wash sales occur.
    private processRealizedLots(rows:DefaultObject[], rowIndex: number, closedLot: BrokerageTransaction): BrokerageRealizedLot[]
    {
        let ret: BrokerageRealizedLot[] = [];
        let originalRow = rows[rowIndex];

        // gather the original lots and wash sale lots
        let originalLots: { date: Date, price: Money, costBasis: Money, quantity:number }[]= []; 
        let washSales : { amount: Money, quantity:number }[] = [];
        for (let j = rowIndex + 1; j < rows.length; j = j + 1) {
            let row = rows[j];
            let hasOpenDateTime = Utils.fallbackKeyValue(row, ["OpenDateTime"]).length > 0;
            let isClosed = this.positionClosed(row) && hasOpenDateTime;
            let isWashSale = hasOpenDateTime && row["WhenRealized"].length > 0;
            if ((isClosed || isWashSale)
                && row["ClientAccountID"] == originalRow["ClientAccountID"]
                && row["Symbol"] == originalRow["Symbol"] 
                && row["TransactionType"].length == 0)
            {
                let quantity = Utils.normalizeNumberStringToNumber(row["Quantity"]);
                if (isClosed) {
                    originalLots.push({
                        date: parseDate(row["OpenDateTime"], "yyyyMMdd;HHmmss", new Date()),
                        price: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["TradePrice"]) },
                        costBasis: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["CostBasis"]) },
                        quantity: quantity
                    });
                }
                else if (isWashSale) {
                    washSales.push({
                        quantity: quantity,
                        amount: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["FifoPnlRealized"]) }
                    });
                }
            }
            else 
            {
                break;
            }
        }

        // setup the realized lots
        for (let i = 0; i < originalLots.length; ++i) {
            let ol = originalLots[i];
            ret.push({
                acquisitionAmount:  ol.costBasis,
                acquisitionDate: ol.date,
                acquisitionPrice: ol.price,
                description: closedLot.description,
                liquidationAmount: { currencyCode: closedLot.amount.currencyCode, value: (closedLot.amount.value * ol.quantity) / (-1 * closedLot.quantity) },
                liquidationDate: closedLot.tradeDate,
                liquidationPrice: closedLot.price,
                quantity: ol.quantity,
                symbol: closedLot.symbol
            });
        }
        
        // process wash sale adjustments. go through each wash sale lot and adjust the next realized lot
        if (ret.length > 0)
        {
            let currentRealizedLotIndex = -1;
            let currentRealizedQuantity = 0;
            for (let i = 0; i < washSales.length; ++i) {
                if (currentRealizedQuantity == 0) {
                    currentRealizedLotIndex++;
                    if (currentRealizedLotIndex >= ret.length) {
                        throw `Not all wash sales processed for ${originalRow["Symbol"]}`;
                    }
                    currentRealizedQuantity = ret[currentRealizedLotIndex].quantity;
                }

                let washLot = washSales[i];
                let adjustmentQuantity = Math.min(currentRealizedQuantity, washLot.quantity);
                let adjustmentAmount = washLot.amount.value * adjustmentQuantity / washLot.quantity;
                washLot.quantity -= adjustmentQuantity;
                washLot.amount.value -= adjustmentAmount;
                ret[currentRealizedLotIndex].acquisitionAmount.value -= adjustmentAmount; 
                if (washLot.quantity > 0) {
                    i = i - 1;
                }
                currentRealizedQuantity -= adjustmentQuantity;
                if (currentRealizedQuantity < 0) {
                    throw `Unexpected error with wash sale quantity`;
                }
            }
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
            postedDate: this.getDateTime(row)
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
            tradeDate: this.getDateTime(row),
            symbol: row["Symbol"]
        };
    }

    private priorMtmPositionForRow(row: DefaultObject): PriorMtmPosition {
        return {
            description: row["Description"],
            date: parseDate(row["Date"], "yyyyMMdd", new Date()),
            pnl: { currencyCode: row["CurrencyPrimary"], value: Utils.normalizeNumberStringToNumber(row["PriorMtmPnl"]) },
            symbol: row["Symbol"]
        }
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
                if ("TransactionType" in row && row["TransactionType"].length > 0) {
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
        if ("PPPO" in groups) {
            groups["PPPO"].forEach(row => {
                let statement = this.statementForRow(row);
                if (statement != null) {
                    statement.priorMtmPositions.push(this.priorMtmPositionForRow(row));
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
