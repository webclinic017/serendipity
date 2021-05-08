import { DefaultObject, Utils } from "../utils";
import { BrokerageHolding, BrokerageHoldingFromJSON, BrokerageRealizedLot, BrokerageTransaction, BrokerageTransactionStatusEnum, BrokerageTransactionTransactionTypeEnum, Statement } from "../gen/finance/models";
import { CsvStatementExtractor } from './';
import { parse as parseDate } from 'date-fns';
import { StatementExtractorFactory } from "./StatementExtractorFactory";
import { parsed } from "yargs";

export class MerrillEdge
{
    public static institutionName = "Merrill Edge";
    private static nonOccOptionRegex = new RegExp("([a-zA-Z]+)#([a-zA-Z])([0-9]{2})([0-9]{2})([a-zA-Z])([0-9]+)");

    public static symbolToOccCode(symbol: string)
    {
        let m = symbol.match(this.nonOccOptionRegex);
        if (m == null)
            return symbol;
        let sec = m[1];
        let monthStr = m[2];
        let day = m[3];
        let year = m[4];
        let ndivide = m[5].charCodeAt(0) - "A".charCodeAt(0) + 1;
        let price = Math.round(parseInt(m[6]) / Math.pow(10, ndivide)) * 1000;
        let month = monthStr.charCodeAt(0) - "A".charCodeAt(0) + 1;
        let call: string = "C";
        if (month > 12) {
            month = month  - 12
            call = "P"
        }
        return `${sec}${year}${month.toString().padStart(2, "0")}${day}${call}${price.toString().padStart(8, "0")}`;
    }
}

export class MerrillEdgeCsvExtractor extends CsvStatementExtractor
{
    private static r = StatementExtractorFactory.registerStatementCsvExtractorClass(MerrillEdgeCsvExtractor.prototype);

    private statementForRow(row: DefaultObject): Statement {
        let dateStr = "";
        if ("Date" in row) {
            dateStr = row["Date"];
        }
        else if ("COB Date" in row) {
            dateStr = row["COB Date"];
        }
        let date:Date = null;
        if (dateStr.length > 0) {
            date = parseDate(dateStr, "MM/dd/yyyy", new Date());
        }
        else {
            date = new Date();
        }
        return {
            accountNumber: row["Account #"],
            startDate: date,
            endDate: date,
            institutionName: MerrillEdge.institutionName,
            brokerageHoldings: [],
            brokerageRealizedLots: [],
            brokerageTransactions: []
        }
    }

    private holdingForRow(row: DefaultObject): BrokerageHolding {
        return {
            costBasis: { 
                currencyCode: "USD", 
                value: (() => {
                    if ("Cost Basis ($)" in row) {
                        return Utils.normalizeNumberStringToNumber(row["Cost Basis ($)"]);
                    }
                    else if ("Unrealized Gain/Loss ($)" in row && "Value ($)" in row) {
                        let gain = Utils.normalizeNumberStringToNumber(row["Unrealized Gain/Loss ($)"]);
                        let price = Utils.normalizeNumberStringToNumber(row["Value ($)"]);
                        return price - gain;
                    }
                    return undefined;
                })()
            },
            purchaseDate: (() => { 
                if ("Acquisition Date" in row) {
                    return parseDate(row["Acquisition Date"], "MM/dd/yyyy", new Date())
                }
                return undefined;
            })(),
            quantity: Utils.normalizeNumberStringToNumber(row["Quantity"]),
            symbol: MerrillEdge.symbolToOccCode(row["Symbol"]),
            value: { 
                start: { currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Value ($)"]) },
                end: { currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Value ($)"]) },
            }
        }
    }
    
    private realizedLotForRow(row: DefaultObject): BrokerageRealizedLot {
        return {
            acquisitionAmount: {
                currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Acquisition Cost ($)"])
            },
            acquisitionDate: parseDate(row["Acquisition Date"], "MM/dd/yyyy", new Date()),
            acquisitionPrice: {
                currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Acquisition Price ($)"])
            },
            description: row["Security Description"],
            liquidationAmount: {
                currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Liquidation Amount ($)"])
            },
            liquidationDate: parseDate(row["Liquidation Date"], "MM/dd/yyyy", new Date()),
            liquidationPrice: {
                currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Liquidation Price ($)"])
            },
            quantity: Utils.normalizeNumberStringToNumber(row["Quantity"]),
            symbol: row["Security"]
        };
    }

    private static gDescriptionToTransactionMap: {[key:string]:BrokerageTransactionTransactionTypeEnum } = {
        "Deposit": BrokerageTransactionTransactionTypeEnum.Deposit,
        "Dividend": BrokerageTransactionTransactionTypeEnum.Dividend,
        "Bank Interest": BrokerageTransactionTransactionTypeEnum.Interest,
        "Option Assigned": BrokerageTransactionTransactionTypeEnum.OptionAssigned,
        "Option Expired": BrokerageTransactionTransactionTypeEnum.OptionExpired,
        "Option Exercised": BrokerageTransactionTransactionTypeEnum.OptionExercised,
        "Option Purchase": BrokerageTransactionTransactionTypeEnum.Purchase,
        "Option Sale": BrokerageTransactionTransactionTypeEnum.Sale,
        "Purchase": BrokerageTransactionTransactionTypeEnum.Purchase,
        "Sale": BrokerageTransactionTransactionTypeEnum.Sale,
        "Sale-Option Exercised": BrokerageTransactionTransactionTypeEnum.SaleOptionExercised,
        "Transfer / Adjustment": BrokerageTransactionTransactionTypeEnum.Unknown
    };

    private transactionForRow(row: DefaultObject): BrokerageTransaction {
        return {
            amount: {
                currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Amount ($)"])
            },
            description: row["Description 2"],
            price: {
                currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Price ($)"])
            },
            quantity: Utils.normalizeNumberStringToNumber(row["Quantity"]),
            tradeDate: parseDate(row["Trade Date"], "MM/dd/yyyy", new Date()),
            settlementDate: parseDate(row["Settlement Date"], "MM/dd/yyyy", new Date()),
            transactionType: MerrillEdgeCsvExtractor.gDescriptionToTransactionMap[row["Description 1"]],
            symbol: row["Symbol/CUSIP #"],
            status: row["Pending/Settled"] == "Pending" ? BrokerageTransactionStatusEnum.Pending : BrokerageTransactionStatusEnum.Settled
        };
    }

    public process(csv: string): Statement[] {
        let rows = Utils.rowsToJson(Utils.parseCsvTrim(csv));
        let ret = new Array<Statement>();
        let statements: {[key:string]: Statement} = {};
        for (let i = 0; i < rows.length; ++i) {
            let row:any = rows[i];
            let accountNumber = row["Account #"];
            if (accountNumber.length == 0)
                continue;
            let statement: Statement;
            if (!(accountNumber in statements)) {
                statement = statements[accountNumber] = this.statementForRow(row);
                ret.push(statement);
            }
            else {
                statement = statements[accountNumber];
            }
            if ("Liquidation Date" in row) {
                statement.brokerageRealizedLots.push(this.realizedLotForRow(row));
            }
            else if ("Pending/Settled" in row) {
                statement.brokerageTransactions.push(this.transactionForRow(row));
            }
            else {
                statement.brokerageHoldings.push(this.holdingForRow(row));
            }
        }
        return ret;
    }

    public canProcess(csv: string)
    {
        return csv.indexOf("CMA-Edge") >= 0;
    }

    public institutionName()
    {
        return MerrillEdge.institutionName;
    }
}
