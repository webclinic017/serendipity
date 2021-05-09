import { DefaultObject, Utils } from "../utils";
import { BrokerageHolding, Statement } from "../gen/finance/models";
import { CsvStatementExtractor } from '.'
import { parse as parseDate, format as formatDate } from 'date-fns';
import { StatementExtractorFactory } from "./StatementExtractorFactory";

export class Fidelity
{
    public static institutionName = "Fidelity";

    public static toOccCode(symbol: string, description: string)
    {
        if (symbol.indexOf("-") < 0)
            return symbol;

        let p = description.split(" ");
        let date = formatDate(parseDate(`${p[1]} ${p[2]} ${p[3]}`, "MMM dd yyyy", new Date()), "yyMMdd");
        let price = (Utils.normalizeNumberStringToNumber(p[4]) * 1000).toString().padStart(8, "0");
        // Need to construct the code from the description
        let call = p[5] == "CALL" ? "C" : "P";
        return `${p[0]}${date}${call}${price}`;
    }
}

export class FidelityCsvExtractor extends CsvStatementExtractor
{
    private static r = StatementExtractorFactory.registerStatementCsvExtractorClass(FidelityCsvExtractor.prototype);
    private reportDate: Date;

    private statementForRow(accountNumber: string, row: DefaultObject): Statement {
        return {
            accountNumber: accountNumber,
            startDate: this.reportDate,
            endDate: this.reportDate,
            institutionName: Fidelity.institutionName,
            brokerageHoldings: [],
            brokerageTransactions: []
        }
    }

    private holdingForRow(row: DefaultObject): BrokerageHolding {
        return {
            costBasis: { currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Cost Basis"])},
            quantity: Utils.normalizeNumberStringToNumber(row["Quantity"]),
            symbol: Fidelity.toOccCode(row["Symbol"], row["Description"]),
            value: { 
                start: { currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Current Value"]) },
                end: { currencyCode: "USD", value: Utils.normalizeNumberStringToNumber(row["Current Value"]) },
            }
        }
    }

    public canProcess(csv: string)
    {
        return csv.indexOf("Fidelity Brokerage Services") >= 0;
    }

    public process(csv: string)
    {
        let reportDateRegex = new RegExp("Date downloaded ([0-9]{2}/[0-9]{2}/[0-9]{4})")
        let m = csv.match(reportDateRegex);

        if (m == null)
            return null;

        this.reportDate = parseDate(m[1], "MM/dd/yyyy", new Date());

        let data = Utils.parseCsvTrim(csv);
        let columns = data[0];
        data = data.filter(e => e.length > 1);
        let rows = Utils.rowsToJson(data);
        
        let ret:Statement[] = [];

        let statements:{[key:string]: Statement} = {};
        rows.forEach((row) => {
            // TODO: pending activity
            if (row["Symbol"] == undefined || row["Quantity"].length == 0)
                return;
            let accountNumber = row["Account Name/Number"];
            if (accountNumber.length == 0)
                return;
            let statement: Statement;
            if (!(accountNumber in statements)) {
                statement = statements[accountNumber] = this.statementForRow(accountNumber, row);
                ret.push(statement);
            }
            else {
                statement = statements[accountNumber];
            }
            statement.brokerageHoldings.push(this.holdingForRow(row));

        })
        return ret;
    }

    public institutionName()
    {
        return Fidelity.institutionName;
    }
}
